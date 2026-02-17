import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"

type EncryptOptions = {
	stdin?: boolean
	json?: boolean
}

type CliErrorCode =
	| "INVALID_ENVIRONMENT_NAME"
	| "MISSING_STDIN"
	| "ENVIRONMENT_NOT_FOUND"
	| "ACCESS_DENIED"
	| "NO_PUBLIC_KEYS"
	| "NO_PRIVATE_KEYS"
	| "PASSPHRASE_PROTECTED_KEYS"
	| "UNKNOWN"

type JsonSuccess = {
	ok: true
}

type JsonFailure = {
	ok: false
	error: {
		code: CliErrorCode
		message: string
	}
}

type EncryptCommandDeps = {
	validateEnvironmentName: typeof validateEnvironmentName
	encryptEnvironment: typeof encryptEnvironment
	readStdin: () => Promise<string>
	writeStdout: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultEncryptCommandDeps: EncryptCommandDeps = {
	validateEnvironmentName,
	encryptEnvironment,
	readStdin: () =>
		new Promise<string>((resolve, reject) => {
			let input = ""

			process.stdin.setEncoding("utf-8")
			process.stdin.on("data", (chunk) => {
				input += chunk
			})
			process.stdin.on("end", () => {
				resolve(input)
			})
			process.stdin.on("error", reject)
		}),
	writeStdout: (message) => process.stdout.write(message),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (value: string) => value.replace(ansiPattern, "")

const mapErrorCode = (message: string): CliErrorCode => {
	if (message.includes("Environment file not found")) {
		return "ENVIRONMENT_NOT_FOUND"
	}
	if (message === "Access denied to the environment.") {
		return "ACCESS_DENIED"
	}
	if (message.includes("No private keys found")) {
		return "NO_PRIVATE_KEYS"
	}
	if (message.includes("No public keys found")) {
		return "NO_PUBLIC_KEYS"
	}
	if (message.toLowerCase().includes("passphrase-protected")) {
		return "PASSPHRASE_PROTECTED_KEYS"
	}
	return "UNKNOWN"
}

const writeJson = (
	message: JsonSuccess | JsonFailure,
	deps: Pick<EncryptCommandDeps, "writeStdout">,
) => {
	deps.writeStdout(`${JSON.stringify(message)}\n`)
}

const runWithoutConsoleNoise = async (fn: () => Promise<void>) => {
	const originalLog = console.log
	const originalError = console.error

	try {
		console.log = () => {}
		console.error = () => {}
		await fn()
	} finally {
		console.log = originalLog
		console.error = originalError
	}
}

export const encryptCommand = async (
	environmentName: string,
	options: EncryptOptions,
	_command?: unknown,
	deps: EncryptCommandDeps = defaultEncryptCommandDeps,
) => {
	const validation = deps.validateEnvironmentName(environmentName)

	if (!validation.valid) {
		if (options.json) {
			writeJson(
				{
					ok: false,
					error: {
						code: "INVALID_ENVIRONMENT_NAME",
						message: validation.reason,
					},
				},
				deps,
			)
		} else {
			deps.logError(validation.reason)
		}
		deps.exit(1)
	}

	if (!options.stdin) {
		const message =
			'No input source provided. Use "--stdin" and pipe the plaintext content.'
		if (options.json) {
			writeJson(
				{
					ok: false,
					error: {
						code: "MISSING_STDIN",
						message,
					},
				},
				deps,
			)
		} else {
			deps.logError(message)
		}
		deps.exit(1)
	}

	try {
		const content = await deps.readStdin()
		if (options.json) {
			await runWithoutConsoleNoise(async () => {
				await deps.encryptEnvironment(environmentName, content)
			})
			writeJson({ ok: true }, deps)
			return
		}

		await deps.encryptEnvironment(environmentName, content)
	} catch (error: unknown) {
		const rawMessage =
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment."
		const message = stripAnsi(rawMessage)
		const code = mapErrorCode(message)

		if (options.json) {
			writeJson(
				{
					ok: false,
					error: { code, message },
				},
				deps,
			)
		} else {
			deps.logError(message)
		}
		deps.exit(1)
	}
}

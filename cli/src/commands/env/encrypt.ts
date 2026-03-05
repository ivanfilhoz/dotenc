import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { readStdin } from "../../helpers/readStdin"
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

const writeJson = (message: JsonSuccess | JsonFailure) => {
	process.stdout.write(`${JSON.stringify(message)}\n`)
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
) => {
	const validation = validateEnvironmentName(environmentName)

	if (!validation.valid) {
		if (options.json) {
			writeJson({
				ok: false,
				error: {
					code: "INVALID_ENVIRONMENT_NAME",
					message: validation.reason,
				},
			})
		} else {
			console.error(validation.reason)
		}
		process.exit(1)
	}

	if (!options.stdin) {
		const message =
			'No input source provided. Use "--stdin" and pipe the plaintext content.'
		if (options.json) {
			writeJson({
				ok: false,
				error: {
					code: "MISSING_STDIN",
					message,
				},
			})
		} else {
			console.error(message)
		}
		process.exit(1)
	}

	try {
		const content = await readStdin()
		if (options.json) {
			await runWithoutConsoleNoise(async () => {
				await encryptEnvironment(environmentName, content)
			})
			writeJson({ ok: true })
			return
		}

		await encryptEnvironment(environmentName, content)
	} catch (error: unknown) {
		const rawMessage =
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment."
		const message = stripAnsi(rawMessage)
		const code = mapErrorCode(message)

		if (options.json) {
			writeJson({
				ok: false,
				error: { code, message },
			})
		} else {
			console.error(message)
		}
		process.exit(1)
	}
}

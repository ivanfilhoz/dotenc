import { decryptEnvironmentData } from "../../helpers/decryptEnvironment"
import { getEnvironmentByName } from "../../helpers/getEnvironmentByName"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"

type DecryptOptions = {
	json?: boolean
}

type CliErrorCode =
	| "INVALID_ENVIRONMENT_NAME"
	| "ENVIRONMENT_NOT_FOUND"
	| "ACCESS_DENIED"
	| "NO_PRIVATE_KEYS"
	| "PASSPHRASE_PROTECTED_KEYS"
	| "UNKNOWN"

type JsonSuccess = {
	ok: true
	content: string
	grantedUsers: string[]
}

type JsonFailure = {
	ok: false
	error: {
		code: CliErrorCode
		message: string
	}
}

type DecryptCommandDeps = {
	validateEnvironmentName: typeof validateEnvironmentName
	getEnvironmentByName: typeof getEnvironmentByName
	decryptEnvironmentData: typeof decryptEnvironmentData
	writeStdout: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultDecryptCommandDeps: DecryptCommandDeps = {
	validateEnvironmentName,
	getEnvironmentByName,
	decryptEnvironmentData,
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
	if (message.toLowerCase().includes("passphrase-protected")) {
		return "PASSPHRASE_PROTECTED_KEYS"
	}
	return "UNKNOWN"
}

const writeJson = (
	message: JsonSuccess | JsonFailure,
	deps: Pick<DecryptCommandDeps, "writeStdout">,
) => {
	deps.writeStdout(`${JSON.stringify(message)}\n`)
}

export const decryptCommand = async (
	environmentName: string,
	options: DecryptOptions,
	_command?: unknown,
	deps: DecryptCommandDeps = defaultDecryptCommandDeps,
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

	try {
		const environment = await deps.getEnvironmentByName(environmentName)
		const plaintext = await deps.decryptEnvironmentData(
			environmentName,
			environment,
		)
		const grantedUsers = Array.from(
			new Set(
				environment.keys
					.map((key) => key.name.trim())
					.filter((name) => name.length > 0),
			),
		)

		if (options.json) {
			writeJson({ ok: true, content: plaintext, grantedUsers }, deps)
		} else {
			deps.writeStdout(plaintext)
		}
	} catch (error: unknown) {
		const rawMessage =
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment."
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

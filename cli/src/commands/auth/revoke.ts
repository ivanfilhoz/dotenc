import chalk from "chalk"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getPublicKeyByName } from "../../helpers/getPublicKeyByName"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"

export type RevokeCommandDeps = {
	decryptEnvironment: typeof decryptEnvironment
	encryptEnvironment: typeof encryptEnvironment
	getPublicKeyByName: typeof getPublicKeyByName
	validateEnvironmentName: typeof validateEnvironmentName
	chooseEnvironmentPrompt: typeof chooseEnvironmentPrompt
	choosePublicKeyPrompt: typeof choosePublicKeyPrompt
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultRevokeCommandDeps: RevokeCommandDeps = {
	decryptEnvironment,
	encryptEnvironment,
	getPublicKeyByName,
	validateEnvironmentName,
	chooseEnvironmentPrompt,
	choosePublicKeyPrompt,
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

const isRevokeCommandDeps = (value: unknown): value is RevokeCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"decryptEnvironment" in value &&
		"encryptEnvironment" in value &&
		"getPublicKeyByName" in value &&
		"validateEnvironmentName" in value &&
		"chooseEnvironmentPrompt" in value &&
		"choosePublicKeyPrompt" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const revokeCommand = async (
	environmentNameArg: string,
	publicKeyNameArg: string,
	commandOrDeps?: unknown,
) => {
	const deps = isRevokeCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultRevokeCommandDeps

	const environmentName =
		environmentNameArg ||
		(await deps.chooseEnvironmentPrompt(
			"What environment do you want to revoke access from?",
		))

	const validation = deps.validateEnvironmentName(environmentName)
	if (!validation.valid) {
		deps.logError(`${chalk.red("Error:")} ${validation.reason}`)
		deps.exit(1)
	}

	let currentContent!: string
	try {
		currentContent = await deps.decryptEnvironment(environmentName)
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment.",
		)
		deps.exit(1)
	}

	let publicKeyName = publicKeyNameArg
	if (!publicKeyName) {
		publicKeyName = await deps.choosePublicKeyPrompt(
			"Which public key do you want to revoke access to this environment?",
		)
	}

	try {
		await deps.getPublicKeyByName(publicKeyName)
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while retrieving the public key.",
		)
		deps.exit(1)
	}

	try {
		await deps.encryptEnvironment(environmentName, currentContent, {
			revokePublicKeys: [publicKeyName],
		})
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		deps.exit(1)
	}
}

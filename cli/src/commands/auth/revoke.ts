import chalk from "chalk"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getPublicKeyByName } from "../../helpers/getPublicKeyByName"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"

export const revokeCommand = async (
	environmentNameArg: string,
	publicKeyNameArg: string,
) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt(
			"What environment do you want to revoke access from?",
		))

	const validation = validateEnvironmentName(environmentName)
	if (!validation.valid) {
		console.error(`${chalk.red("Error:")} ${validation.reason}`)
		process.exit(1)
	}

	let currentContent: string
	try {
		currentContent = await decryptEnvironment(environmentName)
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment.",
		)
		process.exit(1)
	}

	let publicKeyName = publicKeyNameArg
	if (!publicKeyName) {
		publicKeyName = await choosePublicKeyPrompt(
			"Which public key do you want to revoke access to this environment?",
		)
	}

	try {
		await getPublicKeyByName(publicKeyName)
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while retrieving the public key.",
		)
		process.exit(1)
	}

	try {
		await encryptEnvironment(environmentName, currentContent, {
			revokePublicKeys: [publicKeyName],
		})
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		process.exit(1)
	}
}

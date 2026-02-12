import { decryptEnvironment } from "../helpers/decryptEnvironment"
import { encryptEnvironment } from "../helpers/encryptEnvironment"
import { getPublicKeyByName } from "../helpers/getPublicKeyByName"
import { chooseEnvironmentPrompt } from "../prompts/chooseEnvironment"
import { choosePublicKeyPrompt } from "../prompts/choosePublicKey"

export const grantCommand = async (
	environmentNameArg: string,
	publicKeyNameArg: string,
) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt(
			"What environment do you want to grant access to?",
		))

	let currentContent: string
	try {
		currentContent = await decryptEnvironment(environmentName)
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment.",
		)
		return
	}

	let publicKeyName = publicKeyNameArg
	if (!publicKeyName) {
		publicKeyName = await choosePublicKeyPrompt(
			"Which public key do you want to grant access to this environment?",
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
		return
	}

	try {
		await encryptEnvironment(environmentName, currentContent, {
			grantPublicKeys: [publicKeyName],
		})
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		return
	}
}

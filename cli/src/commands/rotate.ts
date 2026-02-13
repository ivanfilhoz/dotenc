import { decryptEnvironment } from "../helpers/decryptEnvironment"
import { encryptEnvironment } from "../helpers/encryptEnvironment"
import { chooseEnvironmentPrompt } from "../prompts/chooseEnvironment"

export const rotateCommand = async (environmentNameArg: string) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt(
			"What environment do you want to rotate the data key for?",
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

	try {
		await encryptEnvironment(environmentName, currentContent)
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		return
	}

	console.log(`Data key for ${environmentName} has been rotated.`)
}

import chalk from "chalk"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"

export const rotateCommand = async (environmentNameArg: string) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt(
			"What environment do you want to rotate the data key for?",
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

	try {
		await encryptEnvironment(environmentName, currentContent)
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		process.exit(1)
	}

	console.log(`Data key for ${environmentName} has been rotated.`)
}

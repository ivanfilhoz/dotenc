import chalk from "chalk"
import { addKey } from "../../helpers/key"
import { getProjectConfig } from "../../helpers/projectConfig"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import { inputKeyPrompt } from "../../prompts/inputKey"

export const keyImportCommand = async (
	environmentArg: string,
	keyArg: string,
) => {
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	let environment = environmentArg

	if (!environment) {
		environment = await chooseEnvironmentPrompt(
			"What environment do you want to import the key to?",
		)
	}

	let key = keyArg

	if (!key) {
		key = await inputKeyPrompt("Paste the key here:")
	}

	await addKey(projectId, environment, key)
	console.log(`\nKey imported to the ${chalk.cyan(environment)} environment.`)
}

import chalk from "chalk"
import { getKey } from "../../helpers/key"
import { getProjectConfig } from "../../helpers/projectConfig"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"

export const keyExportCommand = async (environmentArg: string) => {
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	let environment = environmentArg

	if (!environment) {
		environment = await chooseEnvironmentPrompt(
			"What environment do you want to export the key from?",
		)
	}

	const key = await getKey(environment)

	if (!key) {
		console.error(
			`\nNo key found for the ${chalk.cyan(environment)} environment.`,
		)
		return
	}

	console.log(
		`\nKey for the ${chalk.cyan(environment)} environment: ${chalk.gray(key)}`,
	)
}

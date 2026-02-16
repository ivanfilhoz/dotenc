import chalk from "chalk"
import { getEnvironmentByName } from "../../helpers/getEnvironmentByName"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"

export const authListCommand = async (environmentNameArg: string) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt(
			"What environment do you want to list access for?",
		))

	const validation = validateEnvironmentName(environmentName)
	if (!validation.valid) {
		console.error(`${chalk.red("Error:")} ${validation.reason}`)
		return
	}

	const environment = await getEnvironmentByName(environmentName)

	if (!environment.keys.length) {
		console.log(`No keys have access to ${environmentName}.`)
		return
	}

	for (const key of environment.keys) {
		console.log(key.name)
	}
}

import inquirer from "inquirer"
import { getEnvironments } from "../helpers/getEnvironments"

export const chooseEnvironmentPrompt = async (message: string) => {
	const environments = await getEnvironments()

	if (!environments.length) {
		console.log(
			'No environment files found. To create a new environment, run "dotenc create"',
		)
	}

	const result = await inquirer.prompt([
		{
			type: "list",
			name: "environment",
			message,
			choices: environments,
		},
	])

	return result.environment as string
}

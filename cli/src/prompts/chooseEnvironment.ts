import inquirer from "inquirer"
import { getEnvironments } from "../helpers/getEnvironments"

type ChooseEnvironmentPromptDeps = {
	getEnvironments: typeof getEnvironments
	prompt: typeof inquirer.prompt
	logInfo: (message: string) => void
}

const defaultDeps: ChooseEnvironmentPromptDeps = {
	getEnvironments,
	prompt: inquirer.prompt,
	logInfo: (message) => console.log(message),
}

export const _runChooseEnvironmentPrompt = async (
	message: string,
	depsOverrides: Partial<ChooseEnvironmentPromptDeps> = {},
) => {
	const deps: ChooseEnvironmentPromptDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	const environments = await deps.getEnvironments()

	if (!environments.length) {
		deps.logInfo(
			'No environment files found. To create a new environment, run "dotenc env create"',
		)
	}

	const result = await deps.prompt([
		{
			type: "list",
			name: "environment",
			message,
			choices: environments,
		},
	])

	return result.environment as string
}

export const chooseEnvironmentPrompt = async (message: string) => {
	return _runChooseEnvironmentPrompt(message)
}

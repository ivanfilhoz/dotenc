import inquirer from "inquirer"

export const createEnvironmentPrompt = async (
	message: string,
	defaultValue?: string,
) => {
	const result = await inquirer.prompt([
		{
			type: "input",
			name: "environment",
			message,
			default: defaultValue,
		},
	])

	return result.environment
}

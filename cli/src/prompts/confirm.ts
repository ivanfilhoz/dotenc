import inquirer from "inquirer"

export const confirmPrompt = async (message: string) => {
	const result = await inquirer.prompt([
		{
			type: "confirm",
			name: "confirm",
			message,
		},
	])

	return result.confirm as boolean
}

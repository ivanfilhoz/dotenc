import inquirer from "inquirer"

export const inputNamePrompt = async (
	message: string,
	defaultValue?: string,
) => {
	const result = await inquirer.prompt([
		{
			type: "input",
			name: "name",
			message,
			default: defaultValue,
			filter: (input: string) =>
				input
					// allow only alphanumeric characters, underscores, and hyphens
					.replace(/[^a-zA-Z0-9_-]/g, "")
					// remove leading and trailing whitespace
					.trim()
					.toLocaleLowerCase(),
		},
	])

	return result.name as string
}

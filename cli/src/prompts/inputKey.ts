import inquirer from "inquirer"

export const inputKeyPrompt = async (
	message: string,
	defaultValue?: string,
) => {
	const result = await inquirer.prompt([
		{
			type: "password",
			name: "key",
			mask: "*",
			message,
			default: defaultValue,
		},
	])

	return result.key as string
}

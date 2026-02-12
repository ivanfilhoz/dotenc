import inquirer from "inquirer"
import { getPrivateKeys } from "../helpers/getPrivateKeys"

type ChoosePrivateKeyPromptReturn<T extends boolean> = T extends true
	? string[]
	: string

export const choosePrivateKeyPrompt = async <T extends boolean = false>(
	message: string,
	multiple?: T,
): Promise<ChoosePrivateKeyPromptReturn<T>> => {
	const privateKeys = await getPrivateKeys()

	const result = await inquirer.prompt([
		{
			type: multiple ? "list" : "checkbox",
			name: "key",
			message,
			choices: privateKeys.map((key) => key.name.replace(".pem", "")),
		},
	])

	return result.key as ChoosePrivateKeyPromptReturn<T>
}

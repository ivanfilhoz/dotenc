import inquirer from "inquirer"
import { getPublicKeys } from "../helpers/getPublicKeys"

export const choosePublicKeyPrompt = async (
	message: string,
	multiple?: boolean,
) => {
	const publicKeys = await getPublicKeys()

	const result = await inquirer.prompt([
		{
			type: multiple ? "list" : "checkbox",
			name: "key",
			message,
			choices: publicKeys.map((key) => key.name.replace(".pub", "")),
		},
	])

	return result.key
}

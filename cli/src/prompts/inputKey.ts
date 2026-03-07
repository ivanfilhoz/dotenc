import { prompt } from "./prompt"

export const inputKeyPrompt = async (
	message: string,
	defaultValue?: string,
) => {
	const result = await prompt([
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

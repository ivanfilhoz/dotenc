import { prompt } from "./prompt"

export const confirmPrompt = async (message: string) => {
	const result = await prompt([
		{
			type: "confirm",
			name: "confirm",
			message,
		},
	])

	return result.confirm as boolean
}

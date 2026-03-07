import { prompt } from "./prompt"

export const createEnvironmentPrompt = async (
	message: string,
	defaultValue?: string,
) => {
	const result = await prompt([
		{
			type: "input",
			name: "environment",
			message,
			default: defaultValue,
		},
	])

	return result.environment
}

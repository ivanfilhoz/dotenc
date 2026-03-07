import inquirer from "inquirer"

// Wraps inquirer.prompt so that Ctrl+C (ExitPromptError) exits cleanly
// instead of showing a stack trace. Use this everywhere instead of
// calling inquirer.prompt directly.
export const prompt = (async (
	questions: Parameters<typeof inquirer.prompt>[0],
) => {
	try {
		return await inquirer.prompt(questions)
	} catch (error) {
		if (error instanceof Error && error.name === "ExitPromptError") {
			process.exit(0)
		}
		throw error
	}
}) as typeof inquirer.prompt

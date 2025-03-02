import inquirer from "inquirer"
import fs from "node:fs/promises"

export const chooseEnvironmentPrompt = async (message: string) => {
	const files = await fs.readdir(process.cwd())
	const envFiles = files.filter(
		(file) => file.startsWith(".env.") && file.endsWith(".enc"),
	)

	if (!envFiles.length) {
		console.log(
			'No environment files found. To create a new environment, run "npx safe-env init"',
		)
	}

	const result = await inquirer.prompt([
		{
			type: "list",
			name: "environment",
			message,
			choices: envFiles.map((file) =>
				file.replace(".env.", "").replace(".enc", ""),
			),
		},
	])

	return result.environment
}

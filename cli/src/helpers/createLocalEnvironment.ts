import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

export const createLocalEnvironment = async () => {
	const gitignorePath = path.join(process.cwd(), ".gitignore")
	const envEntry = ".env"

	let gitignoreContent: string[] = []
	if (existsSync(gitignorePath)) {
		gitignoreContent = (await fs.readFile(gitignorePath, "utf8")).split("\n")
	}

	// Check if the .env entry already exists (ignoring comments and whitespace)
	const isEnvIgnored = gitignoreContent.some((line) => line.trim() === envEntry)

	if (!isEnvIgnored) {
		// Append the .env entry to the .gitignore file
		await fs.appendFile(
			gitignorePath,
			`\n# Ignore local environment file\n${envEntry}\n`,
		)
		console.debug("Updated .gitignore to ignore .env file.")
	} else {
		console.debug(".env file is already ignored in .gitignore.")
	}

	const envPath = path.join(process.cwd(), ".env")
	if (existsSync(envPath)) {
		console.debug(".env file already exists.")
	} else {
		await fs.writeFile(envPath, "")
		console.debug("Created .env file.")
	}
}

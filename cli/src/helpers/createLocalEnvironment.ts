import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

export const createLocalEnvironment = async () => {
	const gitignorePath = path.join(process.cwd(), ".gitignore")
	const envEntry = ".env"

	let gitignoreContent: string[] = []
	if (existsSync(gitignorePath)) {
		gitignoreContent = (await fs.readFile(gitignorePath, "utf-8")).split("\n")
	}

	// Check if the .env entry already exists (ignoring comments and whitespace)
	const isEnvIgnored = gitignoreContent.some((line) => line.trim() === envEntry)

	if (!isEnvIgnored) {
		// Append the .env entry to the .gitignore file
		await fs.appendFile(
			gitignorePath,
			`\n# Ignore local environment file\n${envEntry}\n`,
		)
	}

	const envPath = path.join(process.cwd(), ".env")
	if (!existsSync(envPath)) {
		await fs.writeFile(envPath, "# Local environment variables\n", "utf-8")
	}
}

import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getProjectConfig } from "./projectConfig"

export const getToken = async (environment: string) => {
	if (process.env.DOTENC_TOKEN) {
		return process.env.DOTENC_TOKEN
	}

	const { projectId } = await getProjectConfig()

	const tokensFile = path.join(os.homedir(), ".dotenc", "tokens.json")
	if (existsSync(tokensFile)) {
		const tokens = JSON.parse(await fs.readFile(tokensFile, "utf-8"))
		return tokens[projectId][environment]
	}

	throw new Error(
		"No token found. Please set the TOKEN environment variable or import the token using `dotenc import-token -e <environment> <token>`.",
	)
}

/**
 * Adds or updates a token for a specific project and environment.
 */
export const addToken = async (
	projectId: string,
	environment: string,
	token: string,
) => {
	const tokensFile = path.join(os.homedir(), ".dotenc", "tokens.json")

	// Ensure the tokens file exists
	if (!existsSync(tokensFile)) {
		await fs.mkdir(path.dirname(tokensFile), { recursive: true })
		await fs.writeFile(tokensFile, "{}", { mode: 0o600 }) // Create an empty JSON file with secure permissions
	}

	// Read the existing tokens
	const tokens = JSON.parse(await fs.readFile(tokensFile, "utf8"))

	// Add or update the token
	if (!tokens[projectId]) {
		tokens[projectId] = {}
	}
	tokens[projectId][environment] = token

	// Write the updated tokens back to the file
	await fs.writeFile(tokensFile, JSON.stringify(tokens, null, 2), {
		mode: 0o600,
	})
	console.debug(
		`Token for project "${projectId}" and environment "${environment}" added successfully.`,
	)
}

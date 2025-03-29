import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getProjectConfig } from "./projectConfig"

const keysFile = path.join(os.homedir(), ".dotenc", "keys.json")

export const getKey = async (environment: string, index = 0) => {
	if (process.env.DOTENC_KEY) {
		const keys = process.env.DOTENC_KEY.split(",")
		return keys[index]
	}

	const { projectId } = await getProjectConfig()

	if (existsSync(keysFile)) {
		const keys = JSON.parse(await fs.readFile(keysFile, "utf-8"))
		return keys[projectId][environment]
	}

	throw new Error(
		"No key found. Please set the DOTENC_KEY environment variable or import the key using `dotenc key import <environment> <key>`.",
	)
}

/**
 * Adds or updates a key for a specific project and environment.
 */
export const addKey = async (
	projectId: string,
	environment: string,
	key: string,
) => {
	// Ensure the keys file exists
	if (!existsSync(keysFile)) {
		await fs.mkdir(path.dirname(keysFile), { recursive: true })
		await fs.writeFile(keysFile, "{}", { mode: 0o600 }) // Create an empty JSON file with secure permissions
	}

	// Read the existing keys
	const keys = JSON.parse(await fs.readFile(keysFile, "utf8"))

	// Add or update the key
	if (!keys[projectId]) {
		keys[projectId] = {}
	}
	keys[projectId][environment] = key

	// Write the updated keys back to the file
	await fs.writeFile(keysFile, JSON.stringify(keys, null, 2), {
		mode: 0o600,
	})
}

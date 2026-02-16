import fs from "node:fs/promises"
import { type Environment, environmentSchema } from "../schemas/environment"

export const getEnvironmentByPath = async (
	filePath: string,
): Promise<Environment> => {
	let environmentInput: string
	try {
		environmentInput = await fs.readFile(filePath, "utf-8")
	} catch (_error) {
		throw new Error(`Environment file not found: ${filePath}`)
	}

	let environmentJson: Environment

	try {
		const rawJson = JSON.parse(environmentInput)
		environmentJson = environmentSchema.parse(rawJson)
	} catch (_error) {
		throw new Error(
			"Failed to parse the environment file. Please ensure it is a valid JSON file.",
		)
	}

	return environmentJson
}

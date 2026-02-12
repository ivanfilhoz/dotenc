import fs from "node:fs/promises"
import path from "node:path"
import { type Environment, environmentSchema } from "../schemas/environment"

export const getEnvironmentByName = async (name: string) => {
	let environmentInput: string
	try {
		environmentInput = await fs.readFile(
			path.join(process.cwd(), `.env.${name}.enc`),
			"utf-8",
		)
	} catch (error) {
		throw new Error(`Environment file not found: .env.${name}.enc`)
	}

	let environmentJson: Environment

	try {
		const rawJson = JSON.parse(environmentInput)
		environmentJson = environmentSchema.parse(rawJson)
	} catch (error) {
		throw new Error(
			"Failed to parse the environment file. Please ensure it is a valid JSON file.",
		)
	}

	return environmentJson
}

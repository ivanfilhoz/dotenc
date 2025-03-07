import crypto from "node:crypto"
import { createEnvironment } from "../helpers/createEnvironment"
import { createLocalEnvironment } from "../helpers/createLocalEnvironment"
import { createProject } from "../helpers/createProject"
import { addToken } from "../helpers/token"
import { createEnvironmentPrompt } from "../prompts/createEnvironment"

export const initCommand = async (environmentArg: string) => {
	// Generate a unique project ID
	const { projectId } = await createProject()

	// Setup local environment
	await createLocalEnvironment()

	// Generate a random token
	const token = crypto.randomBytes(32).toString("base64")

	// Prompt for the environment name
	let environment = environmentArg

	if (!environment) {
		environment = await createEnvironmentPrompt(
			"What should the environment be named?",
			"development",
		)
	}

	await createEnvironment(environment, token)

	// Store the token
	await addToken(projectId, environment, token)

	// Output success message
	console.log("Initialization complete!")
	console.log("Next steps:")
	console.log(
		`1. Use "dotenc edit ${environment}" to securely edit your environment variables.`,
	)
	console.log(
		`2. Use "dotenc run -e ${environment} <command> [args...]" or "DOTENC_ENV=${environment} dotenc run <command> [args...]" to run your application.`,
	)
	console.log(
		'3. Use "dotenc init [environment]" to initialize a new environment.',
	)
	console.log(
		"4. Use the git-ignored .env file for local development. It will have priority over any encrypted environment variables.",
	)
}

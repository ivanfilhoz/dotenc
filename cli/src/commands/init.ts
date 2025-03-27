import chalk from "chalk"
import crypto from "node:crypto"
import { createEnvironment } from "../helpers/createEnvironment"
import { createLocalEnvironment } from "../helpers/createLocalEnvironment"
import { createProject } from "../helpers/createProject"
import { environmentExists } from "../helpers/environmentExists"
import { getEnvironmentNameSuggestion } from "../helpers/getEnvironmentNameSuggestion"
import { addKey } from "../helpers/key"
import { createEnvironmentPrompt } from "../prompts/createEnvironment"

export const initCommand = async (environmentArg: string) => {
	// Generate a unique project ID
	const { projectId } = await createProject()

	// Setup local environment
	await createLocalEnvironment()

	// Generate a random key
	const key = crypto.randomBytes(32).toString("base64")

	// Prompt for the environment name
	let environment = environmentArg

	if (!environment) {
		environment = await createEnvironmentPrompt(
			"What should the environment be named?",
			getEnvironmentNameSuggestion(),
		)
	}

	if (!environment) {
		console.log(`${chalk.red("Error:")} no environment name provided`)
		return
	}

	if (environmentExists(environment)) {
		console.log(
			`${chalk.red("Error:")} environment ${environment} already exists. To edit it, use ${chalk.gray(
				`dotenc edit ${environment}`,
			)}`,
		)
		return
	}

	await createEnvironment(environment, key)

	// Store the key
	await addKey(projectId, environment, key)

	// Output success message
	console.log(`${chalk.green("✔")} Initialization complete!`)
	console.log("\nSome useful tips:")
	const editCommand = chalk.gray(`dotenc edit ${environment}`)
	console.log(`\n- To securely edit your environment:\t${editCommand}`)
	const runCommand = chalk.gray(
		`dotenc run -e ${environment} <command> [args...]`,
	)
	const runCommandWithEnv = chalk.gray(
		`DOTENC_ENV=${environment} dotenc run <command> [args...]`,
	)
	console.log(
		`- To run your application:\t\t${runCommand} or ${runCommandWithEnv}`,
	)
	const initCommand = chalk.gray("dotenc init [environment]")
	console.log(`- To initialize a new environment:\t${initCommand}`)
	console.log(
		`- Use the git-ignored ${chalk.gray(".env")} file for local development. It will have priority over any encrypted environments.`,
	)
}

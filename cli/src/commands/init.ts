import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { createLocalEnvironment } from "../helpers/createLocalEnvironment"
import { createProject } from "../helpers/createProject"
import { getPrivateKeys } from "../helpers/getPrivateKeys"
import { choosePrivateKeyPrompt } from "../prompts/choosePrivateKey"
import { keyAddCommand } from "./key/add"
import { keyGenerateCommand } from "./key/generate"

export const initCommand = async () => {
	// Check if a private key already exists
	let privateKeys = await getPrivateKeys()

	if (!privateKeys.length) {
		console.log("To get started, let's create a new private key for you.")
		await keyGenerateCommand("")
	}

	privateKeys = await getPrivateKeys()
	if (!privateKeys.length) {
		console.error(
			`${chalk.red("Error:")} to initialize a project, you need at least one private key.`,
		)
		return
	}

	// Bootstrap the project
	if (!existsSync(path.join(process.cwd(), "dotenc.json"))) {
		console.log("No project found. Let's create a new one.")

		try {
			const { projectId } = await createProject()
			fs.writeFile(
				path.join(process.cwd(), "dotenc.json"),
				JSON.stringify({ projectId }, null, 2),
				"utf-8",
			)
		} catch (error) {
			console.error(`${chalk.red("Error:")} failed to create the project.`)
			console.error(
				`${chalk.red("Details:")} ${error instanceof Error ? error.message : error}`,
			)
			return
		}
	}

	// Add the public key to the project
	let privateKeysToAdd: string[] = []

	if (privateKeys.length === 1) {
		privateKeysToAdd = privateKeys.map((key) => key.name)
	} else {
		privateKeysToAdd = await choosePrivateKeyPrompt(
			"Which keys would you like to use in this project?",
			true,
		)
	}

	if (!privateKeysToAdd.length) {
		console.error(
			`${chalk.red("Error:")} no private keys selected. Please select at least one key.`,
		)
		return
	}

	for (const privateKeyName of privateKeysToAdd) {
		console.log(`Adding key: ${chalk.cyan(privateKeyName)}`)
		await keyAddCommand("", {
			fromPrivateKey: privateKeyName,
		})
	}

	// Create a local environment file for the user
	try {
		await createLocalEnvironment()
	} catch (error) {
		console.error(
			`${chalk.red("Error:")} failed to create the local environment.`,
		)
		console.error(
			`${chalk.red("Details:")} ${error instanceof Error ? error.message : error}`,
		)
		return
	}

	// Output success message
	console.log(`${chalk.green("✔")} Initialization complete!`)
	console.log("\nSome useful tips:")
	const createCmd = chalk.gray("dotenc create [environment]")
	console.log(`- To create a new environment:\t\t${createCmd}`)
	console.log(
		`- Use the git-ignored ${chalk.gray(".env")} file for local development. It will have priority over any encrypted environments.`,
	)
}

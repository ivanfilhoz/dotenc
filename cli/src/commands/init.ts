import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { createProject } from "../helpers/createProject"
import { passphraseProtectedKeyError } from "../helpers/errors"
import { getPrivateKeys } from "../helpers/getPrivateKeys"
import { setupGitDiff } from "../helpers/setupGitDiff"
import { inputNamePrompt } from "../prompts/inputName"
import { createCommand } from "./env/create"
import { keyAddCommand } from "./key/add"

type Options = {
	name?: string
}

export const initCommand = async (options: Options) => {
	// Scan for SSH keys
	const { keys: privateKeys, passphraseProtectedKeys } =
		await getPrivateKeys()

	if (!privateKeys.length) {
		if (passphraseProtectedKeys.length > 0) {
			console.error(passphraseProtectedKeyError(passphraseProtectedKeys))
		} else {
			console.error(
				`${chalk.red("Error:")} no SSH keys found in ~/.ssh/. Please generate one first using ${chalk.gray("ssh-keygen")}.`,
			)
		}
		return
	}

	// Prompt for username
	const username =
		options.name ||
		(await inputNamePrompt("What's your name?", os.userInfo().username))

	if (!username) {
		console.error(`${chalk.red("Error:")} no name provided.`)
		return
	}

	// Bootstrap the project
	if (!existsSync(path.join(process.cwd(), "dotenc.json"))) {
		console.log("No project found. Let's create a new one.")

		try {
			const { projectId } = await createProject()
			await fs.writeFile(
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

	// Single key selection
	let keyToAdd: string

	if (privateKeys.length === 1) {
		keyToAdd = privateKeys[0].name
	} else {
		const result = await inquirer.prompt([
			{
				type: "list",
				name: "key",
				message: "Which SSH key would you like to use?",
				choices: privateKeys.map((key) => ({
					name: `${key.name} (${key.algorithm})`,
					value: key.name,
				})),
			},
		])
		keyToAdd = result.key
	}

	if (!keyToAdd) {
		console.error(
			`${chalk.red("Error:")} no SSH key selected. Please select a key.`,
		)
		return
	}

	// Derive and add public key to the project
	const keyEntry = privateKeys.find((k) => k.name === keyToAdd)
	if (!keyEntry) return

	console.log(`Adding key: ${chalk.cyan(username)} (${keyEntry.algorithm})`)

	const publicKey = crypto.createPublicKey(keyEntry.privateKey)
	const publicKeyPem = publicKey
		.export({ type: "spki", format: "pem" })
		.toString()

	await keyAddCommand(username, {
		fromString: publicKeyPem,
	})

	// Set up git diff driver for encrypted files
	try {
		setupGitDiff()
	} catch (_error) {
		console.warn(
			`${chalk.yellow("Warning:")} could not set up git diff driver. You can run ${chalk.gray("dotenc init")} again inside a git repository.`,
		)
	}

	// Create personal encrypted environment
	// If .env exists, use its contents as initial content, then delete it
	let initialContent: string | undefined
	const envPath = path.join(process.cwd(), ".env")

	if (existsSync(envPath)) {
		initialContent = await fs.readFile(envPath, "utf-8")
		await fs.unlink(envPath)
		console.log(
			`Migrated ${chalk.gray(".env")} contents to ${chalk.cyan(username)} environment.`,
		)
	}

	await createCommand(username, username, initialContent)

	// Output success message
	console.log(`\n${chalk.green("✔")} Initialization complete!`)
	console.log("\nSome useful tips:")
	const editCmd = chalk.gray(`dotenc env edit ${username}`)
	console.log(`- To edit your personal environment:\t${editCmd}`)
	const devCmd = chalk.gray("dotenc dev <command>")
	console.log(`- To run with your encrypted env:\t${devCmd}`)
}

import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { createLocalEnvironment } from "../helpers/createLocalEnvironment"
import { createProject } from "../helpers/createProject"
import { getPrivateKeys } from "../helpers/getPrivateKeys"
import { keyAddCommand } from "./key/add"

export const initCommand = async () => {
	// Scan for SSH keys
	const privateKeys = await getPrivateKeys()

	if (!privateKeys.length) {
		console.error(
			`${chalk.red("Error:")} no SSH keys found in ~/.ssh/. Please generate one first using ${chalk.gray("ssh-keygen")}.`,
		)
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

	// Let user choose which SSH keys to add
	let keysToAdd: string[] = []

	if (privateKeys.length === 1) {
		keysToAdd = [privateKeys[0].name]
	} else {
		const result = await inquirer.prompt([
			{
				type: "checkbox",
				name: "keys",
				message: "Which SSH keys would you like to use in this project?",
				choices: privateKeys.map((key) => ({
					name: `${key.name} (${key.algorithm})`,
					value: key.name,
				})),
			},
		])
		keysToAdd = result.keys
	}

	if (!keysToAdd.length) {
		console.error(
			`${chalk.red("Error:")} no SSH keys selected. Please select at least one key.`,
		)
		return
	}

	// Derive and add public keys to the project
	for (const keyName of keysToAdd) {
		const keyEntry = privateKeys.find((k) => k.name === keyName)
		if (!keyEntry) continue

		console.log(
			`Adding key: ${chalk.cyan(keyName)} (${keyEntry.algorithm})`,
		)

		// Derive public key from private key
		const publicKey = crypto.createPublicKey(keyEntry.privateKey)
		const publicKeyPem = publicKey
			.export({ type: "spki", format: "pem" })
			.toString()

		await keyAddCommand(keyName, {
			fromString: publicKeyPem,
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

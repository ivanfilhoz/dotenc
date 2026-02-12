import crypto, { type KeyObject } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { getProjectConfig } from "../../helpers/projectConfig"
import { parseShareableKey } from "../../helpers/share"
import { choosePrivateKeyPrompt } from "../../prompts/choosePrivateKey"
import { inputKeyPrompt } from "../../prompts/inputKey"
import { inputNamePrompt } from "../../prompts/inputName"

type Options = {
	fromShare?: string
	fromPrivateKey?: string
	fromFile?: string
	fromString?: string
}

export const keyAddCommand = async (nameArg?: string, options?: Options) => {
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	let publicKey: KeyObject | undefined
	let filePath: string | undefined

	if (options?.fromPrivateKey) {
		if (
			!existsSync(
				path.join(os.homedir(), ".dotenc", `${options.fromPrivateKey}.pem`),
			)
		) {
			console.error(
				`Private key ${chalk.cyan(options.fromPrivateKey)} does not exist. Please provide a valid private key name.`,
			)
			return
		}

		filePath = path.join(
			os.homedir(),
			".dotenc",
			`${options.fromPrivateKey}.pem`,
		)
	}

	if (options?.fromFile) {
		if (!existsSync(options.fromFile)) {
			console.error(
				`File ${chalk.cyan(options.fromFile)} does not exist. Please provide a valid file path.`,
			)
			return
		}

		filePath = options.fromFile
	}

	if (options?.fromString) {
		try {
			publicKey = crypto.createPublicKey(options.fromString)
		} catch (error) {
			console.error(
				"Invalid public key format. Please provide a valid PEM formatted public key.",
			)
			console.error(
				`Details: ${error instanceof Error ? error.message : error}`,
			)
			return
		}
	}

	if (options?.fromShare) {
		try {
			publicKey = parseShareableKey(options.fromShare)
		} catch (error) {
			console.error(
				"Invalid public key format. Please ensure the shareable key was copied correctly.",
			)
			console.error(
				`Details: ${error instanceof Error ? error.message : error}`,
			)
			return
		}
	}

	// dotenc add
	if (!filePath && !publicKey) {
		const modePrompt = await inquirer.prompt({
			type: "list",
			name: "mode",
			message: "Would you like to add one of your own keys or paste a new one?",
			choices: [
				{ name: "Choose from my own keys", value: "choose" },
				{ name: "Paste a new public key", value: "paste" },
			],
		})

		if (modePrompt.mode === "paste") {
			const publicKeyInput = await inputKeyPrompt(
				"Please paste your public key (PEM format):",
			)

			if (!publicKeyInput) {
				console.error("No public key provided. Add operation cancelled.")
				return
			}

			try {
				publicKey = crypto.createPublicKey(publicKeyInput)
			} catch (error: unknown) {
				console.error(
					"Invalid public key format. Please provide a valid PEM formatted public key.",
				)
				console.error(
					`Details: ${error instanceof Error ? error.message : error}`,
				)
				return
			}
		} else {
			const privateKeyName = await choosePrivateKeyPrompt(
				"What key do you want to add?",
			)

			filePath = path.join(os.homedir(), ".dotenc", `${privateKeyName}.pem`)
		}
	}

	// all cases except "paste"
	if (filePath) {
		const keyInput = await fs.readFile(filePath, "utf-8")

		try {
			publicKey = crypto.createPublicKey(keyInput)
		} catch (error) {
			console.error(
				"Invalid key format. Please provide a valid PEM formatted public or private key.",
			)
			console.error(
				`Details: ${error instanceof Error ? error.message : error}`,
			)
			return
		}
	}

	// unexpected path - if ever reached, it's a bug
	if (!publicKey) {
		console.error(
			"An unexpected error occurred. No public key was inferred from the provided input.",
		)
		return
	}

	const publicKeyOutput = publicKey.export({
		type: "spki",
		format: "pem",
	})

	// Create folder if it doesn't exist
	if (!existsSync(path.join(process.cwd(), ".dotenc"))) {
		await fs.mkdir(path.join(process.cwd(), ".dotenc"))
	}

	// try to use the same name as the private key if provided
	let name = nameArg || options?.fromPrivateKey
	if (options?.fromPrivateKey && !nameArg) {
		if (
			existsSync(
				path.join(process.cwd(), ".dotenc", `${options.fromPrivateKey}.pub`),
			)
		) {
			console.log(
				"A public key with the same name as the private key already exists. Let's pick a new name.",
			)
		} else {
			name = options.fromPrivateKey
		}
	}

	if (!name) {
		name = await inputNamePrompt(
			"What name do you want to give to the new public key?",
		)

		if (existsSync(path.join(process.cwd(), ".dotenc", `${name}.pub`))) {
			console.error(
				`A public key with name ${chalk.cyan(name)} already exists. Please choose a different name.`,
			)
			return
		}
	}

	await fs.writeFile(
		path.join(process.cwd(), ".dotenc", `${name}.pub`),
		publicKeyOutput,
		"utf-8",
	)
	console.log(`\nPublic key ${chalk.cyan(name)} added successfully!`)
}

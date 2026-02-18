import crypto, { type KeyObject } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { isPassphraseProtected } from "../../helpers/isPassphraseProtected"
import { parseOpenSSHPrivateKey } from "../../helpers/parseOpenSSHKey"
import { validatePublicKey } from "../../helpers/validatePublicKey"
import { choosePrivateKeyPrompt } from "../../prompts/choosePrivateKey"
import { inputKeyPrompt } from "../../prompts/inputKey"
import { inputNamePrompt } from "../../prompts/inputName"

type Options = {
	fromSsh?: string
	fromFile?: string
	fromString?: string
}

export const keyAddCommand = async (nameArg?: string, options?: Options) => {
	let publicKey: KeyObject | undefined

	if (options?.fromSsh) {
		// Parse SSH key file (private or public)
		const sshPath = options.fromSsh.startsWith("~")
			? path.join(os.homedir(), options.fromSsh.slice(1))
			: options.fromSsh

		if (!existsSync(sshPath)) {
			console.error(
				`File ${chalk.cyan(sshPath)} does not exist. Please provide a valid SSH key path.`,
			)
			process.exit(1)
		}

		const keyContent = await fs.readFile(sshPath, "utf-8")

		if (isPassphraseProtected(keyContent)) {
			console.error(
				`${chalk.red("Error:")} the provided key is passphrase-protected, which is not currently supported by dotenc.`,
			)
			process.exit(1)
		}

		try {
			// Try as private key first, derive public key
			const privateKey = crypto.createPrivateKey(keyContent)
			publicKey = crypto.createPublicKey(privateKey)
		} catch {
			// Fallback: try OpenSSH private key format
			const parsed = parseOpenSSHPrivateKey(keyContent)
			if (parsed) {
				publicKey = crypto.createPublicKey(parsed)
			} else {
				try {
					// Try as public key
					publicKey = crypto.createPublicKey(keyContent)
				} catch (error) {
					console.error(
						"Invalid SSH key format. Please provide a valid SSH key file.",
					)
					console.error(
						`Details: ${error instanceof Error ? error.message : error}`,
					)
					process.exit(1)
				}
			}
		}
	}

	if (options?.fromFile) {
		if (!existsSync(options.fromFile)) {
			console.error(
				`File ${chalk.cyan(options.fromFile)} does not exist. Please provide a valid file path.`,
			)
			process.exit(1)
		}

		const keyContent = await fs.readFile(options.fromFile, "utf-8")

		if (isPassphraseProtected(keyContent)) {
			console.error(
				`${chalk.red("Error:")} the provided key is passphrase-protected, which is not currently supported by dotenc.`,
			)
			process.exit(1)
		}

		try {
			publicKey = crypto.createPublicKey(keyContent)
		} catch {
			try {
				const privateKey = crypto.createPrivateKey(keyContent)
				publicKey = crypto.createPublicKey(privateKey)
			} catch {
				// Fallback: try OpenSSH private key format
				const parsed = parseOpenSSHPrivateKey(keyContent)
				if (parsed) {
					publicKey = crypto.createPublicKey(parsed)
				} else {
					console.error(
						"Invalid key format. Please provide a valid PEM formatted public or private key.",
					)
					process.exit(1)
				}
			}
		}
	}

	if (options?.fromString) {
		if (isPassphraseProtected(options.fromString)) {
			console.error(
				`${chalk.red("Error:")} the provided key is passphrase-protected, which is not currently supported by dotenc.`,
			)
			process.exit(1)
		}

		try {
			publicKey = crypto.createPublicKey(options.fromString)
		} catch {
			try {
				const privateKey = crypto.createPrivateKey(options.fromString)
				publicKey = crypto.createPublicKey(privateKey)
			} catch {
				// Fallback: try OpenSSH private key format
				const parsed = parseOpenSSHPrivateKey(options.fromString)
				if (parsed) {
					publicKey = crypto.createPublicKey(parsed)
				} else {
					console.error(
						"Invalid key format. Please provide a valid PEM formatted public or private key.",
					)
					process.exit(1)
				}
			}
		}
	}

	// Interactive mode
	if (!publicKey) {
		const modePrompt = await inquirer.prompt({
			type: "list",
			name: "mode",
			message:
				"Would you like to add one of your SSH keys or paste a public key?",
			choices: [
				{ name: "Choose or create an SSH key", value: "choose" },
				{ name: "Paste a public key (PEM format)", value: "paste" },
			],
		})

		if (modePrompt.mode === "paste") {
			const publicKeyInput = await inputKeyPrompt(
				"Please paste your public key (PEM format):",
			)

			if (!publicKeyInput) {
				console.error("No public key provided. Add operation cancelled.")
				process.exit(1)
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
				process.exit(1)
			}
		} else {
			let selectedKey: Awaited<ReturnType<typeof choosePrivateKeyPrompt>>
			try {
				selectedKey = await choosePrivateKeyPrompt(
					"Which SSH key do you want to add?",
				)
			} catch (error) {
				console.error(error instanceof Error ? error.message : String(error))
				process.exit(1)
			}

			publicKey = crypto.createPublicKey(selectedKey.privateKey)
			// Use SSH key filename as default name if no nameArg
			if (!nameArg) {
				nameArg = selectedKey.name
			}
		}
	}

	// unexpected path
	if (!publicKey) {
		console.error(
			"An unexpected error occurred. No public key was inferred from the provided input.",
		)
		process.exit(1)
	}

	const validation = validatePublicKey(publicKey)
	if (!validation.valid) {
		console.error(validation.reason)
		process.exit(1)
	}

	const publicKeyOutput = publicKey.export({
		type: "spki",
		format: "pem",
	})

	// Create folder if it doesn't exist
	if (!existsSync(path.join(process.cwd(), ".dotenc"))) {
		await fs.mkdir(path.join(process.cwd(), ".dotenc"))
	}

	let name = nameArg
	if (!name) {
		name = await inputNamePrompt(
			"What name do you want to give to the new public key?",
		)

		if (existsSync(path.join(process.cwd(), ".dotenc", `${name}.pub`))) {
			console.error(
				`A public key with name ${chalk.cyan(name)} already exists. Please choose a different name.`,
			)
			process.exit(1)
		}
	}

	await fs.writeFile(
		path.join(process.cwd(), ".dotenc", `${name}.pub`),
		publicKeyOutput,
		"utf-8",
	)
	console.log(`\nPublic key ${chalk.cyan(name)} added successfully!`)
}

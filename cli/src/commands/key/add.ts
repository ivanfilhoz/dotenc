import crypto, { type KeyObject } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { getPrivateKeys } from "../../helpers/getPrivateKeys"
import { isPassphraseProtected } from "../../helpers/isPassphraseProtected"
import { parseOpenSSHPrivateKey } from "../../helpers/parseOpenSSHKey"
import { getProjectConfig } from "../../helpers/projectConfig"
import { validatePublicKey } from "../../helpers/validatePublicKey"
import { inputKeyPrompt } from "../../prompts/inputKey"
import { inputNamePrompt } from "../../prompts/inputName"

type Options = {
	fromSsh?: string
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

	if (options?.fromSsh) {
		// Parse SSH key file (private or public)
		const sshPath = options.fromSsh.startsWith("~")
			? path.join(os.homedir(), options.fromSsh.slice(1))
			: options.fromSsh

		if (!existsSync(sshPath)) {
			console.error(
				`File ${chalk.cyan(sshPath)} does not exist. Please provide a valid SSH key path.`,
			)
			return
		}

		const keyContent = await fs.readFile(sshPath, "utf-8")

		if (isPassphraseProtected(keyContent)) {
			console.error(
				`${chalk.red("Error:")} the provided key is passphrase-protected, which is not currently supported by dotenc.`,
			)
			return
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
					return
				}
			}
		}
	}

	if (options?.fromFile) {
		if (!existsSync(options.fromFile)) {
			console.error(
				`File ${chalk.cyan(options.fromFile)} does not exist. Please provide a valid file path.`,
			)
			return
		}

		const keyContent = await fs.readFile(options.fromFile, "utf-8")

		if (isPassphraseProtected(keyContent)) {
			console.error(
				`${chalk.red("Error:")} the provided key is passphrase-protected, which is not currently supported by dotenc.`,
			)
			return
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
					return
				}
			}
		}
	}

	if (options?.fromString) {
		if (isPassphraseProtected(options.fromString)) {
			console.error(
				`${chalk.red("Error:")} the provided key is passphrase-protected, which is not currently supported by dotenc.`,
			)
			return
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
					return
				}
			}
		}
	}

	// Interactive mode
	if (!publicKey) {
		const { keys: sshKeys, passphraseProtectedKeys } = await getPrivateKeys()

		if (sshKeys.length === 0 && passphraseProtectedKeys.length > 0) {
			console.warn(
				`${chalk.yellow("Warning:")} SSH keys were found but are passphrase-protected (not supported by dotenc):\n${passphraseProtectedKeys.map((k) => `  - ${k}`).join("\n")}\n`,
			)
		}

		const choices: { name: string; value: string }[] = sshKeys.map((key) => ({
			name: `${key.name} (${key.algorithm})`,
			value: key.name,
		}))

		const modePrompt = await inquirer.prompt({
			type: "list",
			name: "mode",
			message:
				"Would you like to add one of your SSH keys or paste a public key?",
			choices: [
				...(choices.length
					? [{ name: "Choose from my SSH keys", value: "choose" }]
					: []),
				{ name: "Paste a public key (PEM format)", value: "paste" },
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
			const keyPrompt = await inquirer.prompt({
				type: "list",
				name: "key",
				message: "Which SSH key do you want to add?",
				choices,
			})

			const selectedKey = sshKeys.find((k) => k.name === keyPrompt.key)
			if (!selectedKey) {
				console.error("SSH key not found.")
				return
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
		return
	}

	const validation = validatePublicKey(publicKey)
	if (!validation.valid) {
		console.error(validation.reason)
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

	let name = nameArg
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

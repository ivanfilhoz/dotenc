import crypto, { type KeyObject } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { isPassphraseProtected } from "../../helpers/isPassphraseProtected"
import { parseOpenSSHPrivateKey } from "../../helpers/parseOpenSSHKey"
import { parsePassphraseProtectedPrivateKey } from "../../helpers/parsePassphraseProtectedPrivateKey"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"
import { validateKeyName } from "../../helpers/validateKeyName"
import { validatePublicKey } from "../../helpers/validatePublicKey"
import { choosePrivateKeyPrompt } from "../../prompts/choosePrivateKey"
import { inputKeyPrompt } from "../../prompts/inputKey"
import { inputNamePrompt } from "../../prompts/inputName"

type Options = {
	fromSsh?: string
	fromFile?: string
	fromString?: string
}

type KeyAddCommandDeps = {
	createPrivateKey: typeof crypto.createPrivateKey
	createPublicKey: typeof crypto.createPublicKey
	existsSync: typeof existsSync
	readFile: typeof fs.readFile
	mkdir: typeof fs.mkdir
	writeFile: typeof fs.writeFile
	homedir: typeof os.homedir
	cwd: typeof process.cwd
	prompt: typeof inquirer.prompt
	isPassphraseProtected: typeof isPassphraseProtected
	parseOpenSSHPrivateKey: typeof parseOpenSSHPrivateKey
	resolveProjectRoot: typeof resolveProjectRoot
	validatePublicKey: typeof validatePublicKey
	validateKeyName: typeof validateKeyName
	choosePrivateKeyPrompt: typeof choosePrivateKeyPrompt
	inputKeyPrompt: typeof inputKeyPrompt
	inputNamePrompt: typeof inputNamePrompt
	logError: (message: string) => void
	logInfo: (message: string) => void
	privateKeyPassphrase: string | undefined
	exit: (code: number) => never
}

const defaultDeps: KeyAddCommandDeps = {
	createPrivateKey: crypto.createPrivateKey,
	createPublicKey: crypto.createPublicKey,
	existsSync,
	readFile: fs.readFile,
	mkdir: fs.mkdir,
	writeFile: fs.writeFile,
	homedir: os.homedir,
	cwd: process.cwd,
	prompt: inquirer.prompt,
	isPassphraseProtected,
	parseOpenSSHPrivateKey,
	resolveProjectRoot,
	validatePublicKey,
	validateKeyName,
	choosePrivateKeyPrompt,
	inputKeyPrompt,
	inputNamePrompt,
	logError: (message) => console.error(message),
	logInfo: (message) => console.log(message),
	privateKeyPassphrase: process.env.DOTENC_PRIVATE_KEY_PASSPHRASE,
	exit: (code: number) => process.exit(code),
}

export const _runKeyAddCommand = async (
	nameArg?: string,
	options?: Options,
	depsOverrides: Partial<KeyAddCommandDeps> = {},
) => {
	const deps: KeyAddCommandDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	let publicKey: KeyObject | undefined

	const parsePrivateKeyInput = async (
		keyContent: string,
		passphraseProtected: boolean,
	): Promise<KeyObject> => {
		if (passphraseProtected) {
			if (deps.privateKeyPassphrase === undefined) {
				throw new Error(
					"passphrase-protected key cannot be parsed without a passphrase",
				)
			}

			const privateKey = await parsePassphraseProtectedPrivateKey(
				keyContent,
				deps.privateKeyPassphrase,
			)

			if (!privateKey) {
				throw new Error(
					"failed to decrypt passphrase-protected key with DOTENC_PRIVATE_KEY_PASSPHRASE",
				)
			}

			return privateKey
		}

		return deps.createPrivateKey(keyContent)
	}

	if (options?.fromSsh) {
		// Parse SSH key file (private or public)
		const sshPath = options.fromSsh.startsWith("~")
			? path.join(deps.homedir(), options.fromSsh.slice(1))
			: options.fromSsh

		if (!deps.existsSync(sshPath)) {
			deps.logError(
				`File ${chalk.cyan(sshPath)} does not exist. Please provide a valid SSH key path.`,
			)
			deps.exit(1)
		}

		const keyContent = await deps.readFile(sshPath, "utf-8")
		const passphraseProtected = deps.isPassphraseProtected(keyContent)

		if (passphraseProtected && deps.privateKeyPassphrase === undefined) {
			deps.logError(
				`${chalk.red("Error:")} the provided key is passphrase-protected. Set ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE")} to use it, or provide a passwordless key.`,
			)
			deps.exit(1)
		}

		try {
			// Try as private key first, derive public key
			const privateKey = await parsePrivateKeyInput(
				keyContent,
				passphraseProtected,
			)
			publicKey = deps.createPublicKey(privateKey)
		} catch {
			if (passphraseProtected && deps.privateKeyPassphrase !== undefined) {
				deps.logError(
					`${chalk.red("Error:")} failed to decrypt the provided key with ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE")}. Please verify the passphrase.`,
				)
				deps.exit(1)
			}

			// Fallback: try OpenSSH private key format
			const parsed = deps.parseOpenSSHPrivateKey(keyContent)
			if (parsed) {
				publicKey = deps.createPublicKey(parsed)
			} else {
				try {
					// Try as public key
					publicKey = deps.createPublicKey(keyContent)
				} catch (error) {
					deps.logError(
						"Invalid SSH key format. Please provide a valid SSH key file.",
					)
					deps.logError(
						`Details: ${error instanceof Error ? error.message : error}`,
					)
					deps.exit(1)
				}
			}
		}
	}

	if (options?.fromFile) {
		if (!deps.existsSync(options.fromFile)) {
			deps.logError(
				`File ${chalk.cyan(options.fromFile)} does not exist. Please provide a valid file path.`,
			)
			deps.exit(1)
		}

		const keyContent = await deps.readFile(options.fromFile, "utf-8")
		const passphraseProtected = deps.isPassphraseProtected(keyContent)

		if (passphraseProtected && deps.privateKeyPassphrase === undefined) {
			deps.logError(
				`${chalk.red("Error:")} the provided key is passphrase-protected. Set ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE")} to use it, or provide a passwordless key.`,
			)
			deps.exit(1)
		}

		if (passphraseProtected) {
			try {
				const privateKey = await parsePrivateKeyInput(
					keyContent,
					passphraseProtected,
				)
				publicKey = deps.createPublicKey(privateKey)
			} catch {
				deps.logError(
					`${chalk.red("Error:")} failed to decrypt the provided key with ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE")}. Please verify the passphrase.`,
				)
				deps.exit(1)
			}
		} else {
			try {
				publicKey = deps.createPublicKey(keyContent)
			} catch {
				try {
					const privateKey = await parsePrivateKeyInput(
						keyContent,
						passphraseProtected,
					)
					publicKey = deps.createPublicKey(privateKey)
				} catch {
					// Fallback: try OpenSSH private key format
					const parsed = deps.parseOpenSSHPrivateKey(keyContent)
					if (parsed) {
						publicKey = deps.createPublicKey(parsed)
					} else {
						deps.logError(
							"Invalid key format. Please provide a valid PEM formatted public or private key.",
						)
						deps.exit(1)
					}
				}
			}
		}
	}

	if (options?.fromString) {
		const passphraseProtected = deps.isPassphraseProtected(options.fromString)
		if (passphraseProtected && deps.privateKeyPassphrase === undefined) {
			deps.logError(
				`${chalk.red("Error:")} the provided key is passphrase-protected. Set ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE")} to use it, or provide a passwordless key.`,
			)
			deps.exit(1)
		}

		if (passphraseProtected) {
			try {
				const privateKey = await parsePrivateKeyInput(
					options.fromString,
					passphraseProtected,
				)
				publicKey = deps.createPublicKey(privateKey)
			} catch {
				deps.logError(
					`${chalk.red("Error:")} failed to decrypt the provided key with ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE")}. Please verify the passphrase.`,
				)
				deps.exit(1)
			}
		} else {
			try {
				publicKey = deps.createPublicKey(options.fromString)
			} catch {
				try {
					const privateKey = await parsePrivateKeyInput(
						options.fromString,
						passphraseProtected,
					)
					publicKey = deps.createPublicKey(privateKey)
				} catch {
					// Fallback: try OpenSSH private key format
					const parsed = deps.parseOpenSSHPrivateKey(options.fromString)
					if (parsed) {
						publicKey = deps.createPublicKey(parsed)
					} else {
						deps.logError(
							"Invalid key format. Please provide a valid PEM formatted public or private key.",
						)
						deps.exit(1)
					}
				}
			}
		}
	}

	// Interactive mode
	if (!publicKey) {
		const modePrompt = await deps.prompt({
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
			const publicKeyInput = await deps.inputKeyPrompt(
				"Please paste your public key (PEM format):",
			)

			if (!publicKeyInput) {
				deps.logError("No public key provided. Add operation cancelled.")
				deps.exit(1)
			}

			try {
				publicKey = deps.createPublicKey(publicKeyInput)
			} catch (error: unknown) {
				deps.logError(
					"Invalid public key format. Please provide a valid PEM formatted public key.",
				)
				deps.logError(
					`Details: ${error instanceof Error ? error.message : error}`,
				)
				deps.exit(1)
			}
		} else {
			let selectedKey: Awaited<ReturnType<typeof choosePrivateKeyPrompt>>
			try {
				selectedKey = await deps.choosePrivateKeyPrompt(
					"Which SSH key do you want to add?",
				)
			} catch (error) {
				deps.logError(error instanceof Error ? error.message : String(error))
				deps.exit(1)
			}

			publicKey = deps.createPublicKey(selectedKey.privateKey)
			// Use SSH key filename as default name if no nameArg
			if (!nameArg) {
				nameArg = selectedKey.name
			}
		}
	}

	// unexpected path
	if (!publicKey) {
		deps.logError(
			"An unexpected error occurred. No public key was inferred from the provided input.",
		)
		deps.exit(1)
	}

	const validation = deps.validatePublicKey(publicKey)
	if (!validation.valid) {
		deps.logError(validation.reason)
		deps.exit(1)
	}

	const publicKeyOutput = publicKey.export({
		type: "spki",
		format: "pem",
	})

	let projectRoot: string
	try {
		projectRoot = deps.resolveProjectRoot(deps.cwd(), deps.existsSync)
	} catch {
		// Not yet in a project — fall back to cwd (init flow)
		projectRoot = deps.cwd()
	}
	const dotencDir = path.join(projectRoot, ".dotenc")

	// Create folder if it doesn't exist
	if (!deps.existsSync(dotencDir)) {
		await deps.mkdir(dotencDir)
	}

	let name = nameArg
	if (!name) {
		name = await deps.inputNamePrompt(
			"What name do you want to give to the new public key?",
		)
	}

	const keyNameValidation = deps.validateKeyName(name)
	if (!keyNameValidation.valid) {
		deps.logError(`${chalk.red("Error:")} ${keyNameValidation.reason}`)
		deps.exit(1)
	}

	const keyOutputPath = path.join(dotencDir, `${name}.pub`)

	try {
		await deps.writeFile(keyOutputPath, publicKeyOutput, {
			encoding: "utf-8",
			flag: "wx",
		})
	} catch (error) {
		if (
			error instanceof Error &&
			(error as NodeJS.ErrnoException).code === "EEXIST"
		) {
			deps.logError(
				`A public key with name ${chalk.cyan(name)} already exists. Please choose a different name.`,
			)
			deps.exit(1)
		}
		throw error
	}
	deps.logInfo(`\nPublic key ${chalk.cyan(name)} added successfully!`)
}

export const keyAddCommand = async (nameArg?: string, options?: Options) => {
	return _runKeyAddCommand(nameArg, options)
}

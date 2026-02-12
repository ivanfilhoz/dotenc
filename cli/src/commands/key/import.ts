import crypto, { type KeyObject } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import { inputKeyPrompt } from "../../prompts/inputKey"
import { inputNamePrompt } from "../../prompts/inputName"

type Options = {
	fromFile?: string
	fromString?: string
}

export const keyImportCommand = async (nameArg: string, options: Options) => {
	let name = nameArg

	if (!name) {
		name = await inputNamePrompt(
			"What name do you want to give to the new key?",
		)
	}

	if (existsSync(path.join(os.homedir(), ".dotenc", `${name}.pem`))) {
		console.error(
			`A private key with name ${chalk.cyan(name)} already exists. Please choose a different name.`,
		)
		return
	}

	let keyInput: string | undefined

	if (options.fromFile) {
		if (!existsSync(options.fromFile)) {
			console.error(
				`File ${chalk.cyan(options.fromFile)} does not exist. Please provide a valid file path.`,
			)
			return
		}

		keyInput = await fs.readFile(options.fromFile, "utf-8")
	}

	if (options.fromString) {
		keyInput = options.fromString
	}

	if (!keyInput) {
		keyInput = await inputKeyPrompt(
			"Please paste your private key (PEM format):",
		)
	}

	if (!keyInput) {
		console.error("No private key provided. Import operation cancelled.")
		return
	}

	let privateKey: KeyObject | undefined
	try {
		privateKey = crypto.createPrivateKey(keyInput)

		if (privateKey.symmetricKeySize !== 2048) {
			console.warn(
				`Warning: The private key size is ${privateKey.symmetricKeySize} bits.
				"dotenc currently supports only 2048-bit keys. This key may not work as expected.`,
			)
		}
	} catch (error) {
		console.error(
			"Invalid private key format. Please provide a valid PEM formatted private key.",
		)
		console.error(
			`${chalk.red("Details:")} ${error instanceof Error ? error.message : error}`,
		)
		return
	}

	const privateKeyOutput = privateKey.export({
		type: "pkcs8",
		format: "pem",
	})
	await fs.writeFile(
		path.join(os.homedir(), ".dotenc", `${name}.pem`),
		privateKeyOutput,
		{ mode: 0o600 },
	)

	console.log(`\nPrivate key ${chalk.cyan(name)} imported successfully!`)
}

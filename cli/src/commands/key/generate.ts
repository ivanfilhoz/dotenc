import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import { generateKeyPair } from "../../helpers/crypto"
import { inputNamePrompt } from "../../prompts/inputName"

export const keyGenerateCommand = async (nameArg: string) => {
	let name = nameArg

	if (!name) {
		name = await inputNamePrompt(
			"What name do you want to give to your new private key?",
			os.userInfo().username,
		)
	}

	if (!name) {
		console.error(`${chalk.red("Error:")} no name provided`)
		return
	}

	if (existsSync(path.join(os.homedir(), ".dotenc", `${name}.pem`))) {
		console.error(
			`A private key with name ${chalk.cyan(name)} already exists. Please choose a different name.`,
		)
		return
	}

	const { privateKey } = await generateKeyPair()

	if (!existsSync(path.join(os.homedir(), ".dotenc"))) {
		await fs.mkdir(path.join(os.homedir(), ".dotenc"))
	}

	await fs.writeFile(
		path.join(os.homedir(), ".dotenc", `${name}.pem`),
		privateKey,
		{
			mode: 0o600,
		},
	)

	console.log(`\nPrivate key ${chalk.cyan(name)} created successfully!`)
}

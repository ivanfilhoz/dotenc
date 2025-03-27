import chalk from "chalk"
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createHash } from "../helpers/createHash"
import { decrypt, encrypt } from "../helpers/crypto"
import { getDefaultEditor } from "../helpers/getDefaultEditor"
import { getKey } from "../helpers/key"
import { chooseEnvironmentPrompt } from "../prompts/chooseEnvironment"

export const editCommand = async (environmentArg: string) => {
	let environment = environmentArg

	if (!environment) {
		environment = await chooseEnvironmentPrompt(
			"What environment do you want to edit?",
		)
	}

	const environmentFile = `.env.${environment}.enc`
	const environmentFilePath = path.join(process.cwd(), environmentFile)

	if (!existsSync(environmentFilePath)) {
		console.error(`Environment file not found: ${environmentFilePath}`)
		return
	}

	const key = await getKey(environment)

	if (!key) {
		console.error(
			`\n${chalk.red("Error:")} no key found for the ${chalk.cyan(environment)} environment.`,
		)
		return
	}

	const tempFilePath = path.join(os.tmpdir(), `.env.${environment}`)

	const content = await decrypt(key, environmentFilePath)
	await fs.writeFile(tempFilePath, content)

	const initialHash = createHash(content)

	const editor = await getDefaultEditor()

	try {
		// This will block until the editor process is closed
		execSync(`${editor} ${tempFilePath}`, { stdio: "inherit" })
	} catch (error) {
		console.error(`\nFailed to open editor: ${editor}`)
		return
	}

	const newContent = await fs.readFile(tempFilePath, "utf-8")
	const finalHash = createHash(newContent)

	if (initialHash === finalHash) {
		console.log(
			`\nNo changes were made to the ${chalk.cyan(environment)} environment.`,
		)
	} else {
		await encrypt(key, newContent, environmentFilePath)

		console.log(
			`\nEncrypted ${chalk.cyan(environment)} environment and saved it to ${chalk.gray(environmentFile)}.`,
		)
	}

	await fs.unlink(tempFilePath)
}

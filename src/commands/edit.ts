import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createHash } from "../helpers/createHash"
import { decrypt, encrypt } from "../helpers/crypto"
import { getDefaultEditor } from "../helpers/getDefaultEditor"
import { getToken } from "../helpers/token"
import { chooseEnvironmentPrompt } from "./prompts/chooseEnvironment"

export const editCommand = async (environmentArg: string) => {
	let environment = environmentArg

	if (!environment) {
		environment = await chooseEnvironmentPrompt(
			"What environment do you want to edit?",
		)
	}

	const environmentFilePath = path.join(
		process.cwd(),
		`.env.${environment}.enc`,
	)

	if (!existsSync(environmentFilePath)) {
		throw new Error(`Environment file not found: ${environmentFilePath}`)
	}

	const token = await getToken(environment)
	const tempFilePath = path.join(os.tmpdir(), `.env.${environment}`)

	const content = await decrypt(token, environmentFilePath)
	await fs.writeFile(tempFilePath, content)

	const initialHash = createHash(content)

	const editor = await getDefaultEditor()

	try {
		// This will block until the editor process is closed
		execSync(`${editor} ${tempFilePath}`, { stdio: "inherit" })
	} catch (error) {
		throw new Error(`Failed to open editor: ${editor}`)
	}

	const newContent = await fs.readFile(tempFilePath, "utf-8")
	const finalHash = createHash(newContent)

	if (initialHash === finalHash) {
		console.log(
			`No changes were made to the environment file for "${environment}".`,
		)
	} else {
		await encrypt(token, newContent, environmentFilePath)
		console.log(
			`Encrypted environment file for "${environment}" and saved it to ${environmentFilePath}.`,
		)
	}

	await fs.unlink(tempFilePath)
	console.debug(`Temporary file deleted: ${tempFilePath}`)
}

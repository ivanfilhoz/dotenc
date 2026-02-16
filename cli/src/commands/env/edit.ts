import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import { createHash } from "../../helpers/createHash"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getDefaultEditor } from "../../helpers/getDefaultEditor"
import { getEnvironmentByName } from "../../helpers/getEnvironmentByName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import type { Environment } from "../../schemas/environment"

export const editCommand = async (environmentNameArg: string) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt("What environment do you want to edit?"))

	const environmentFile = `.env.${environmentName}.enc`
	const environmentFilePath = path.join(process.cwd(), environmentFile)

	if (!existsSync(environmentFilePath)) {
		console.error(`Environment file not found: ${environmentFilePath}`)
		return
	}

	let environment: Environment
	let content: string
	try {
		environment = await getEnvironmentByName(environmentName)
		content = await decryptEnvironment(environmentName)
	} catch (error: unknown) {
		console.error(
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment.",
		)
		return
	}

	// Create header
	const separator = "# ---\n"
	content = `# Editing environment: ${environmentName}
# This file is encrypted. Do not share it.
# Any changes made here will be encrypted and saved back to the environment file.
# The following public keys have access to this environment:
${environment.keys.map((key) => `# - ${key.name}`).join("\n")}
# Use 'dotenc auth grant' and/or 'dotenc auth revoke' to manage access.
# Make sure to save your changes before closing the editor.
${separator}${content}`

	const tempFilePath = path.join(os.tmpdir(), `.env.${environmentName}`)
	await fs.writeFile(tempFilePath, content, "utf-8")
	const initialHash = createHash(content)

	const editor = await getDefaultEditor()

	try {
		// This will block until the editor process is closed
		const result = spawnSync(editor, [tempFilePath], { stdio: "inherit" })

		if (result.error) {
			throw result.error
		}

		if (result.status !== 0) {
			console.error(`\nEditor exited with code ${result.status}`)
			return
		}

		let newContent = await fs.readFile(tempFilePath, "utf-8")
		const finalHash = createHash(newContent)

		if (initialHash === finalHash) {
			console.log(
				`\nNo changes were made to the ${chalk.cyan(environmentName)} environment.`,
			)
		} else {
			// strip the header and separator if they exist
			const separatorIndex = newContent.indexOf(separator)
			if (separatorIndex !== -1) {
				const headerEndIndex = newContent.indexOf(separator) + separator.length
				newContent = newContent.slice(headerEndIndex).trim()
			}

			await encryptEnvironment(environmentName, newContent)

			console.log(
				`\nEncrypted ${chalk.cyan(environmentName)} environment and saved it to ${chalk.gray(environmentFile)}.`,
			)
		}
	} catch (error: unknown) {
		console.error(`\nFailed to open editor: ${editor}`)
		console.error(error instanceof Error ? error.message : error)
	} finally {
		await fs.unlink(tempFilePath).catch(() => {})
	}
}

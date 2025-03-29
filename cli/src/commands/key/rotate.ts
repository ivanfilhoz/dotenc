import chalk from "chalk"
import crypto from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"
import { decrypt, encrypt } from "../../helpers/crypto"
import { addKey, getKey } from "../../helpers/key"
import { getProjectConfig } from "../../helpers/projectConfig"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"

export const keyRotateCommand = async (environmentArg: string) => {
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	let environment = environmentArg

	if (!environment) {
		environment = await chooseEnvironmentPrompt(
			"What environment do you want to rotate the key for?",
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
			`\nNo key found for the ${chalk.cyan(environment)} environment.`,
		)
		return
	}

	const content = await decrypt(key, environmentFilePath)

	const newKey = crypto.randomBytes(32).toString("base64")
	await encrypt(newKey, content, environmentFilePath)

	await addKey(projectId, environment, newKey)

	console.log(`\nKey rotated for the ${chalk.cyan(environment)} environment.`)
}

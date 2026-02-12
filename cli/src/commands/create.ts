import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { createDataKey, encryptData } from "../helpers/crypto"
import { environmentExists } from "../helpers/environmentExists"
import { getEnvironmentNameSuggestion } from "../helpers/getEnvironmentNameSuggestion"
import { getPublicKeys } from "../helpers/getPublicKeys"
import { getProjectConfig } from "../helpers/projectConfig"
import { choosePublicKeyPrompt } from "../prompts/choosePublicKey"
import { createEnvironmentPrompt } from "../prompts/createEnvironment"
import type { Environment } from "../schemas/environment"

export const createCommand = async (
	environmentNameArg: string,
	publicKeyNameArg: string,
) => {
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	// Prompt for the environment name
	let environmentName = environmentNameArg

	if (!environmentName) {
		environmentName = await createEnvironmentPrompt(
			"What should the environment be named?",
			getEnvironmentNameSuggestion(),
		)
	}

	if (!environmentName) {
		console.log(`${chalk.red("Error:")} no environment name provided`)
		return
	}

	if (environmentExists(environmentName)) {
		console.log(
			`${chalk.red("Error:")} environment ${environmentName} already exists. To edit it, use ${chalk.gray(
				`dotenc edit ${environmentName}`,
			)}`,
		)
		return
	}

	const availablePublicKeys = await getPublicKeys()
	if (!availablePublicKeys.length) {
		console.log(
			`${chalk.red("Error:")} no public keys found. Please add a public key using ${chalk.gray("dotenc key add")}.`,
		)
		return
	}

	const publicKeys = publicKeyNameArg
		? [publicKeyNameArg]
		: await choosePublicKeyPrompt(
				"Which public key(s) do you want to grant access for this environment?",
				true,
			)
	const dataKey = createDataKey()

	const initialContent = `# ${environmentName} environment\n`
	const encryptedContent = await encryptData(dataKey, initialContent)

	const environmentJson: Environment = {
		keys: [],
		encryptedContent: encryptedContent.toString("base64"),
	}

	for (const publicKeyName of publicKeys) {
		const publicKey = availablePublicKeys.find(
			(key) => key.name === publicKeyName,
		)

		if (!publicKey) {
			console.error(
				`Public key ${chalk.cyan(publicKeyName)} not found or invalid.`,
			)
			continue
		}

		const encryptedDataKey = crypto.publicEncrypt(publicKey.publicKey, dataKey)

		environmentJson.keys.push({
			name: publicKeyName,
			fingerprint: publicKey.fingerprint,
			encryptedDataKey: encryptedDataKey.toString("base64"),
		})
	}

	await fs.writeFile(
		path.join(process.cwd(), `.env.${environmentName}.enc`),
		JSON.stringify(environmentJson, null, 2),
		"utf-8",
	)

	// Output success message
	console.log(
		`${chalk.green("✔")} Environment ${chalk.cyan(environmentName)} created!`,
	)
	console.log("\nSome useful tips:")
	const editCommand = chalk.gray(`dotenc edit ${environmentName}`)
	console.log(`\n- To securely edit your environment:\t${editCommand}`)
	const runCommand = chalk.gray(
		`dotenc run -e ${environmentName} <command> [args...]`,
	)
	const runCommandWithEnv = chalk.gray(
		`DOTENC_ENV=${environmentName} dotenc run <command> [args...]`,
	)
	console.log(
		`- To run your application:\t\t${runCommand} or ${runCommandWithEnv}`,
	)
}

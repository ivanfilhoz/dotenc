import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { createDataKey, encryptData } from "../../helpers/crypto"
import { encryptDataKey } from "../../helpers/encryptDataKey"
import { environmentExists } from "../../helpers/environmentExists"
import { getEnvironmentNameSuggestion } from "../../helpers/getEnvironmentNameSuggestion"
import { getPublicKeys } from "../../helpers/getPublicKeys"
import { getProjectConfig } from "../../helpers/projectConfig"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"
import { createEnvironmentPrompt } from "../../prompts/createEnvironment"
import type { Environment } from "../../schemas/environment"

export const createCommand = async (
	environmentNameArg: string,
	publicKeyNameArg: string,
	initialContent?: string,
) => {
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		process.exit(1)
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
		console.error(`${chalk.red("Error:")} no environment name provided`)
		process.exit(1)
	}

	const validation = validateEnvironmentName(environmentName)
	if (!validation.valid) {
		console.error(`${chalk.red("Error:")} ${validation.reason}`)
		process.exit(1)
	}

	if (environmentExists(environmentName)) {
		console.error(
			`${chalk.red("Error:")} environment ${environmentName} already exists. To edit it, use ${chalk.gray(
				`dotenc env edit ${environmentName}`,
			)}`,
		)
		process.exit(1)
	}

	const availablePublicKeys = await getPublicKeys()
	if (!availablePublicKeys.length) {
		console.error(
			`${chalk.red("Error:")} no public keys found. Please add a public key using ${chalk.gray("dotenc key add")}.`,
		)
		process.exit(1)
	}

	const publicKeys = publicKeyNameArg
		? [publicKeyNameArg]
		: await choosePublicKeyPrompt(
				"Which public key(s) do you want to grant access for this environment?",
				true,
			)
	const dataKey = createDataKey()

	const content = initialContent ?? `# ${environmentName} environment\n`
	const encryptedContent = await encryptData(dataKey, content)

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

		const encrypted = encryptDataKey(publicKey, dataKey)

		environmentJson.keys.push({
			name: publicKeyName,
			fingerprint: publicKey.fingerprint,
			encryptedDataKey: encrypted.toString("base64"),
			algorithm: publicKey.algorithm,
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
	const editCommand = chalk.gray(`dotenc env edit ${environmentName}`)
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

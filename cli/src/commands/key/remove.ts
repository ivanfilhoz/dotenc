import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { decryptEnvironmentData } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getEnvironmentByName } from "../../helpers/getEnvironmentByName"
import { getEnvironments } from "../../helpers/getEnvironments"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"
import { confirmPrompt } from "../../prompts/confirm"

export const keyRemoveCommand = async (nameArg: string) => {
	let name = nameArg

	if (!name) {
		name = await choosePublicKeyPrompt(
			"Which public key do you want to remove?",
		)
	}

	const filePath = path.join(process.cwd(), ".dotenc", `${name}.pub`)
	if (!existsSync(filePath)) {
		console.error(`Public key ${chalk.cyan(name)} not found.`)
		process.exit(1)
	}

	// Find environments this key has access to
	const allEnvironments = await getEnvironments()
	const affectedEnvironments: string[] = []

	for (const envName of allEnvironments) {
		try {
			const env = await getEnvironmentByName(envName)
			if (env.keys.some((key) => key.name === name)) {
				affectedEnvironments.push(envName)
			}
		} catch {
			// Skip environments that can't be read
		}
	}

	if (affectedEnvironments.length > 0) {
		console.log(
			`Key ${chalk.cyan(name)} has access to the following environments:`,
		)
		for (const env of affectedEnvironments) {
			console.log(`  - ${env}`)
		}
		console.log(
			"\nAccess will be revoked from these environments automatically.",
		)
	}

	const confirmed = await confirmPrompt(
		`Are you sure you want to remove key ${name}?`,
	)
	if (!confirmed) {
		console.log("Operation cancelled.")
		return
	}

	// Delete the .pub file
	await fs.unlink(filePath)
	console.log(`Public key ${chalk.cyan(name)} removed successfully.`)

	// Auto-revoke access from affected environments
	for (const envName of affectedEnvironments) {
		try {
			const envJson = await getEnvironmentByName(envName)
			const content = await decryptEnvironmentData(envJson)
			await encryptEnvironment(envName, content, {
				revokePublicKeys: [name],
			})
			console.log(
				`Revoked access from ${chalk.cyan(envName)} environment.`,
			)
		} catch {
			console.warn(
				`${chalk.yellow("Warning:")} could not revoke access from ${chalk.cyan(envName)}. You may need to run ${chalk.gray(`dotenc auth revoke ${envName} ${name}`)} manually or rotate the environment.`,
			)
		}
	}
}

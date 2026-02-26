import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { decryptEnvironmentData } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getEnvironmentByName } from "../../helpers/getEnvironmentByName"
import { getEnvironments } from "../../helpers/getEnvironments"
import { validateKeyName } from "../../helpers/validateKeyName"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"
import { confirmPrompt } from "../../prompts/confirm"

export type KeyRemoveCommandDeps = {
	decryptEnvironmentData: typeof decryptEnvironmentData
	encryptEnvironment: typeof encryptEnvironment
	getEnvironmentByName: typeof getEnvironmentByName
	getEnvironments: typeof getEnvironments
	validateKeyName: typeof validateKeyName
	choosePublicKeyPrompt: typeof choosePublicKeyPrompt
	confirmPrompt: typeof confirmPrompt
	existsSync: typeof existsSync
	unlink: typeof fs.unlink
	cwd: () => string
	log: (message: string) => void
	logError: (message: string) => void
	warn: (message: string) => void
	exit: (code: number) => never
}

const defaultKeyRemoveCommandDeps: KeyRemoveCommandDeps = {
	decryptEnvironmentData,
	encryptEnvironment,
	getEnvironmentByName,
	getEnvironments,
	validateKeyName,
	choosePublicKeyPrompt,
	confirmPrompt,
	existsSync,
	unlink: fs.unlink,
	cwd: () => process.cwd(),
	log: (message) => console.log(message),
	logError: (message) => console.error(message),
	warn: (message) => console.warn(message),
	exit: (code) => process.exit(code),
}

const isKeyRemoveCommandDeps = (
	value: unknown,
): value is KeyRemoveCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"decryptEnvironmentData" in value &&
		"encryptEnvironment" in value &&
		"getEnvironmentByName" in value &&
		"getEnvironments" in value &&
		"validateKeyName" in value &&
		"choosePublicKeyPrompt" in value &&
		"confirmPrompt" in value &&
		"existsSync" in value &&
		"unlink" in value &&
		"cwd" in value &&
		"log" in value &&
		"logError" in value &&
		"warn" in value &&
		"exit" in value
	)
}

export const keyRemoveCommand = async (
	nameArg: string,
	commandOrDeps?: unknown,
) => {
	const deps = isKeyRemoveCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultKeyRemoveCommandDeps

	let name = nameArg

	if (!name) {
		name = await deps.choosePublicKeyPrompt(
			"Which public key do you want to remove?",
		)
	}

	const keyNameValidation = deps.validateKeyName(name)
	if (!keyNameValidation.valid) {
		deps.logError(`${chalk.red("Error:")} ${keyNameValidation.reason}`)
		deps.exit(1)
	}

	const filePath = path.join(deps.cwd(), ".dotenc", `${name}.pub`)
	if (!deps.existsSync(filePath)) {
		deps.logError(`Public key ${chalk.cyan(name)} not found.`)
		deps.exit(1)
	}

	// Find environments this key has access to
	const allEnvironments = await deps.getEnvironments()
	const affectedEnvironments: string[] = []

	for (const envName of allEnvironments) {
		try {
			const env = await deps.getEnvironmentByName(envName)
			if (env.keys.some((key) => key.name === name)) {
				affectedEnvironments.push(envName)
			}
		} catch {
			// Skip environments that can't be read
		}
	}

	if (affectedEnvironments.length > 0) {
		deps.log(
			`Key ${chalk.cyan(name)} has access to the following environments:`,
		)
		for (const env of affectedEnvironments) {
			deps.log(`  - ${env}`)
		}
		deps.log("\nAccess will be revoked from these environments automatically.")
	}

	const confirmed = await deps.confirmPrompt(
		`Are you sure you want to remove key ${name}?`,
	)
	if (!confirmed) {
		deps.log("Operation cancelled.")
		return
	}

	// Delete the .pub file
	await deps.unlink(filePath)
	deps.log(`Public key ${chalk.cyan(name)} removed successfully.`)

	// Auto-revoke access from affected environments
	for (const envName of affectedEnvironments) {
		try {
			const envJson = await deps.getEnvironmentByName(envName)
			const content = await deps.decryptEnvironmentData(envJson)
			await deps.encryptEnvironment(envName, content, {
				revokePublicKeys: [name],
			})
			deps.log(`Revoked access from ${chalk.cyan(envName)} environment.`)
		} catch {
			deps.warn(
				`${chalk.yellow("Warning:")} could not revoke access from ${chalk.cyan(envName)}. You may need to run ${chalk.gray(`dotenc auth revoke ${envName} ${name}`)} manually or rotate the environment.`,
			)
		}
	}
}

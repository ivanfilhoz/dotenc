import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getEnvironmentByName } from "../../helpers/getEnvironmentByName"
import { getEnvironments } from "../../helpers/getEnvironments"
import { validateKeyName } from "../../helpers/validateKeyName"
import { confirmPrompt } from "../../prompts/confirm"

export type AuthPurgeCommandDeps = {
	getEnvironments: typeof getEnvironments
	getEnvironmentByName: typeof getEnvironmentByName
	decryptEnvironment: typeof decryptEnvironment
	encryptEnvironment: typeof encryptEnvironment
	validateKeyName: typeof validateKeyName
	confirmPrompt: typeof confirmPrompt
	existsSync: typeof existsSync
	unlink: typeof fs.unlink
	cwd: () => string
	log: (msg: string) => void
	logError: (msg: string) => void
	exit: (code: number) => never
}

const defaultAuthPurgeCommandDeps: AuthPurgeCommandDeps = {
	getEnvironments,
	getEnvironmentByName,
	decryptEnvironment,
	encryptEnvironment,
	validateKeyName,
	confirmPrompt,
	existsSync,
	unlink: fs.unlink,
	cwd: () => process.cwd(),
	log: (msg) => console.log(msg),
	logError: (msg) => console.error(msg),
	exit: (code) => process.exit(code),
}

const isAuthPurgeCommandDeps = (
	value: unknown,
): value is AuthPurgeCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"getEnvironments" in value &&
		"getEnvironmentByName" in value &&
		"decryptEnvironment" in value &&
		"encryptEnvironment" in value &&
		"validateKeyName" in value &&
		"confirmPrompt" in value &&
		"existsSync" in value &&
		"unlink" in value &&
		"cwd" in value &&
		"log" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const authPurgeCommand = async (
	publicKeyName: string,
	yes: boolean,
	commandOrDeps?: unknown,
) => {
	const deps = isAuthPurgeCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultAuthPurgeCommandDeps

	const keyNameValidation = deps.validateKeyName(publicKeyName)
	if (!keyNameValidation.valid) {
		deps.logError(`${chalk.red("Error:")} ${keyNameValidation.reason}`)
		deps.exit(1)
	}

	const keyFilePath = path.join(deps.cwd(), ".dotenc", `${publicKeyName}.pub`)
	if (!deps.existsSync(keyFilePath)) {
		deps.logError(`Public key ${chalk.cyan(publicKeyName)} not found.`)
		deps.exit(1)
	}

	// Find environments that include this key
	const allEnvironments = await deps.getEnvironments()
	const revocableEnvs: string[] = []
	const zeroRecipientErrors: { name: string; reason: string }[] = []

	for (const envName of allEnvironments) {
		try {
			const env = await deps.getEnvironmentByName(envName)
			if (env.keys.some((k) => k.name === publicKeyName)) {
				const remainingKeys = env.keys.filter((k) => k.name !== publicKeyName)
				if (remainingKeys.length === 0) {
					zeroRecipientErrors.push({
						name: envName,
						reason: "no remaining recipients after revocation",
					})
				} else {
					revocableEnvs.push(envName)
				}
			}
		} catch {
			// Skip environments that can't be read
		}
	}

	// Print what will happen
	if (revocableEnvs.length > 0) {
		deps.log(`Environments to update (revoke + rotate):`)
		for (const envName of revocableEnvs) {
			deps.log(`  - ${envName}`)
		}
	}
	if (zeroRecipientErrors.length > 0) {
		deps.log(`Environments skipped (would have zero recipients):`)
		for (const { name, reason } of zeroRecipientErrors) {
			deps.log(`  - ${name}: ${reason}`)
		}
	}

	if (!yes) {
		const confirmed = await deps.confirmPrompt("Proceed with full offboarding?")
		if (!confirmed) {
			deps.log("Operation cancelled.")
			return
		}
	}

	// Process each revocable environment (best-effort)
	const failures: { name: string; error: string }[] = []
	let successCount = 0

	for (const envName of revocableEnvs) {
		try {
			const content = await deps.decryptEnvironment(envName)
			await deps.encryptEnvironment(envName, content, {
				revokePublicKeys: [publicKeyName],
			})
			successCount++
		} catch (error) {
			failures.push({
				name: envName,
				error: error instanceof Error ? error.message : "unknown error",
			})
		}
	}

	// Delete the .pub file
	await deps.unlink(keyFilePath)

	// Print summary
	const failCount = failures.length
	deps.log(
		`Offboarding complete. ${successCount} environment${successCount !== 1 ? "s" : ""} updated, ${failCount} failed.`,
	)
	if (failures.length > 0) {
		deps.log("Failed environments:")
		for (const { name, error } of failures) {
			deps.logError(`  - ${name}: ${error}`)
		}
	}
	if (zeroRecipientErrors.length > 0) {
		deps.log(
			`${zeroRecipientErrors.length} environment${zeroRecipientErrors.length !== 1 ? "s" : ""} skipped (zero remaining recipients).`,
		)
	}
}

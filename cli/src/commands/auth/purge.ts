import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { decryptEnvironmentData } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { findEnvironmentsRecursive } from "../../helpers/findEnvironmentsRecursive"
import { getEnvironmentByPath } from "../../helpers/getEnvironmentByPath"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"
import { validateKeyName } from "../../helpers/validateKeyName"
import { confirmPrompt } from "../../prompts/confirm"

export type AuthPurgeCommandDeps = {
	findEnvironmentsRecursive: typeof findEnvironmentsRecursive
	getEnvironmentByPath: typeof getEnvironmentByPath
	decryptEnvironmentData: typeof decryptEnvironmentData
	encryptEnvironment: typeof encryptEnvironment
	resolveProjectRoot: typeof resolveProjectRoot
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
	findEnvironmentsRecursive,
	getEnvironmentByPath,
	decryptEnvironmentData,
	encryptEnvironment,
	resolveProjectRoot,
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
		"findEnvironmentsRecursive" in value &&
		"getEnvironmentByPath" in value &&
		"decryptEnvironmentData" in value &&
		"encryptEnvironment" in value &&
		"resolveProjectRoot" in value &&
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

	let projectRoot: string
	try {
		projectRoot = deps.resolveProjectRoot(deps.cwd(), deps.existsSync)
	} catch {
		projectRoot = deps.cwd()
	}

	const keyFilePath = path.join(projectRoot, ".dotenc", `${publicKeyName}.pub`)
	if (!deps.existsSync(keyFilePath)) {
		deps.logError(`Public key ${chalk.cyan(publicKeyName)} not found.`)
		deps.exit(1)
	}

	// Find all environments recursively under the project
	const allEnvFiles = await deps.findEnvironmentsRecursive(projectRoot)
	const revocableEnvs: { name: string; filePath: string; dir: string }[] = []
	const zeroRecipientErrors: { name: string; reason: string }[] = []

	for (const envFile of allEnvFiles) {
		try {
			const env = await deps.getEnvironmentByPath(envFile.filePath)
			if (env.keys.some((k) => k.name === publicKeyName)) {
				const remainingKeys = env.keys.filter((k) => k.name !== publicKeyName)
				if (remainingKeys.length === 0) {
					zeroRecipientErrors.push({
						name: `${envFile.name} (${path.relative(projectRoot, envFile.dir) || "."})`,
						reason: "no remaining recipients after revocation",
					})
				} else {
					revocableEnvs.push(envFile)
				}
			}
		} catch {
			// Skip environments that can't be read
		}
	}

	// Print what will happen
	if (revocableEnvs.length > 0) {
		deps.log("Environments to update (revoke + rotate):")
		for (const envFile of revocableEnvs) {
			const label = path.relative(projectRoot, envFile.dir) || "."
			deps.log(`  - ${envFile.name} (${label})`)
		}
	}
	if (zeroRecipientErrors.length > 0) {
		deps.log("Environments skipped (would have zero recipients):")
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

	for (const envFile of revocableEnvs) {
		try {
			const envJson = await deps.getEnvironmentByPath(envFile.filePath)
			const content = await deps.decryptEnvironmentData(envFile.name, envJson)
			await deps.encryptEnvironment(envFile.name, content, {
				revokePublicKeys: [publicKeyName],
				baseDir: envFile.dir,
			})
			successCount++
		} catch (error) {
			failures.push({
				name: `${envFile.name} (${path.relative(projectRoot, envFile.dir) || "."})`,
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

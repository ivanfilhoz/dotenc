import chalk from "chalk"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { getEnvironments } from "../../helpers/getEnvironments"
import { confirmPrompt } from "../../prompts/confirm"

export type EnvRotateAllCommandDeps = {
	getEnvironments: typeof getEnvironments
	decryptEnvironment: typeof decryptEnvironment
	encryptEnvironment: typeof encryptEnvironment
	confirmPrompt: typeof confirmPrompt
	log: (msg: string) => void
	logError: (msg: string) => void
	exit: (code: number) => never
}

const defaultEnvRotateAllCommandDeps: EnvRotateAllCommandDeps = {
	getEnvironments,
	decryptEnvironment,
	encryptEnvironment,
	confirmPrompt,
	log: (msg) => console.log(msg),
	logError: (msg) => console.error(msg),
	exit: (code) => process.exit(code),
}

const isEnvRotateAllCommandDeps = (
	value: unknown,
): value is EnvRotateAllCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"getEnvironments" in value &&
		"decryptEnvironment" in value &&
		"encryptEnvironment" in value &&
		"confirmPrompt" in value &&
		"log" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const envRotateAllCommand = async (
	yes: boolean,
	commandOrDeps?: unknown,
) => {
	const deps = isEnvRotateAllCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultEnvRotateAllCommandDeps

	const environments = await deps.getEnvironments()

	if (environments.length === 0) {
		deps.log("No environments found.")
		return
	}

	deps.log(`Environments to rotate:`)
	for (const envName of environments) {
		deps.log(`  - ${envName}`)
	}

	if (!yes) {
		const confirmed = await deps.confirmPrompt(
			`Rotate data keys for all ${environments.length} environment${environments.length !== 1 ? "s" : ""}?`,
		)
		if (!confirmed) {
			deps.log("Operation cancelled.")
			return
		}
	}

	for (const envName of environments) {
		try {
			const content = await deps.decryptEnvironment(envName)
			await deps.encryptEnvironment(envName, content)
			deps.log(`${chalk.green("✓")} ${envName}`)
		} catch (error) {
			deps.logError(
				`${chalk.red("✗")} ${envName}: ${error instanceof Error ? error.message : "unknown error"}`,
			)
		}
	}
}

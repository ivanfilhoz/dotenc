import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import { confirmPrompt } from "../../prompts/confirm"

export type EnvDeleteCommandDeps = {
	validateEnvironmentName: typeof validateEnvironmentName
	chooseEnvironmentPrompt: typeof chooseEnvironmentPrompt
	confirmPrompt: typeof confirmPrompt
	existsSync: typeof existsSync
	unlink: typeof fs.unlink
	cwd: () => string
	log: (msg: string) => void
	logError: (msg: string) => void
	exit: (code: number) => never
}

const defaultEnvDeleteCommandDeps: EnvDeleteCommandDeps = {
	validateEnvironmentName,
	chooseEnvironmentPrompt,
	confirmPrompt,
	existsSync,
	unlink: fs.unlink,
	cwd: () => process.cwd(),
	log: (msg) => console.log(msg),
	logError: (msg) => console.error(msg),
	exit: (code) => process.exit(code),
}

const isEnvDeleteCommandDeps = (
	value: unknown,
): value is EnvDeleteCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"validateEnvironmentName" in value &&
		"chooseEnvironmentPrompt" in value &&
		"confirmPrompt" in value &&
		"existsSync" in value &&
		"unlink" in value &&
		"cwd" in value &&
		"log" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const envDeleteCommand = async (
	environmentNameArg: string,
	yes: boolean,
	commandOrDeps?: unknown,
) => {
	const deps = isEnvDeleteCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultEnvDeleteCommandDeps

	const environmentName =
		environmentNameArg ||
		(await deps.chooseEnvironmentPrompt(
			"Which environment do you want to delete?",
		))

	const validation = deps.validateEnvironmentName(environmentName)
	if (!validation.valid) {
		deps.logError(`${chalk.red("Error:")} ${validation.reason}`)
		deps.exit(1)
	}

	const filePath = path.join(deps.cwd(), `.env.${environmentName}.enc`)
	if (!deps.existsSync(filePath)) {
		deps.logError(`Environment ${chalk.cyan(environmentName)} not found.`)
		deps.exit(1)
	}

	if (!yes) {
		const confirmed = await deps.confirmPrompt(
			`Are you sure you want to delete environment ${environmentName}?`,
		)
		if (!confirmed) {
			deps.log("Operation cancelled.")
			return
		}
	}

	await deps.unlink(filePath)
	deps.log(`Environment ${chalk.cyan(environmentName)} deleted.`)
}

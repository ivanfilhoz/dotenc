import { existsSync } from "node:fs"
import path from "node:path"
import chalk from "chalk"
import { decryptEnvironmentData } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { findEnvironmentsRecursive } from "../../helpers/findEnvironmentsRecursive"
import { getEnvironmentByPath } from "../../helpers/getEnvironmentByPath"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import { confirmPrompt } from "../../prompts/confirm"

export type RotateCommandDeps = {
	decryptEnvironmentData: typeof decryptEnvironmentData
	encryptEnvironment: typeof encryptEnvironment
	getEnvironmentByPath: typeof getEnvironmentByPath
	validateEnvironmentName: typeof validateEnvironmentName
	chooseEnvironmentPrompt: typeof chooseEnvironmentPrompt
	findEnvironmentsRecursive: typeof findEnvironmentsRecursive
	resolveProjectRoot: typeof resolveProjectRoot
	confirmPrompt: typeof confirmPrompt
	existsSync: (path: string) => boolean
	cwd: () => string
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultRotateCommandDeps: RotateCommandDeps = {
	decryptEnvironmentData,
	encryptEnvironment,
	getEnvironmentByPath,
	validateEnvironmentName,
	chooseEnvironmentPrompt,
	findEnvironmentsRecursive,
	resolveProjectRoot,
	confirmPrompt,
	existsSync,
	cwd: () => process.cwd(),
	log: (message) => console.log(message),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

const isRotateCommandDeps = (value: unknown): value is RotateCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"decryptEnvironmentData" in value &&
		"encryptEnvironment" in value &&
		"getEnvironmentByPath" in value &&
		"validateEnvironmentName" in value &&
		"chooseEnvironmentPrompt" in value &&
		"findEnvironmentsRecursive" in value &&
		"resolveProjectRoot" in value &&
		"confirmPrompt" in value &&
		"existsSync" in value &&
		"cwd" in value &&
		"log" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const rotateCommand = async (
	environmentNameArg: string,
	all: boolean,
	yes: boolean,
	commandOrDeps?: unknown,
) => {
	const deps = isRotateCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultRotateCommandDeps

	if (all) {
		let projectRoot: string
		try {
			projectRoot = deps.resolveProjectRoot(deps.cwd(), deps.existsSync)
		} catch {
			projectRoot = deps.cwd()
		}

		const envFiles = await deps.findEnvironmentsRecursive(projectRoot)

		if (envFiles.length === 0) {
			deps.log("No environments found.")
			return
		}

		deps.log("Environments to rotate:")
		for (const envFile of envFiles) {
			const label = path.relative(projectRoot, envFile.dir) || "."
			deps.log(`  - ${envFile.name} (${label})`)
		}

		if (!yes) {
			const confirmed = await deps.confirmPrompt(
				`Rotate data keys for all ${envFiles.length} environment${envFiles.length !== 1 ? "s" : ""}?`,
			)
			if (!confirmed) {
				deps.log("Operation cancelled.")
				return
			}
		}

		for (const envFile of envFiles) {
			try {
				const envJson = await deps.getEnvironmentByPath(envFile.filePath)
				const content = await deps.decryptEnvironmentData(envFile.name, envJson)
				await deps.encryptEnvironment(envFile.name, content, {
					baseDir: envFile.dir,
				})
				const label = path.relative(projectRoot, envFile.dir) || "."
				deps.log(`${chalk.green("✓")} ${envFile.name} (${label})`)
			} catch (error) {
				const label = path.relative(projectRoot, envFile.dir) || "."
				deps.logError(
					`${chalk.red("✗")} ${envFile.name} (${label}): ${error instanceof Error ? error.message : "unknown error"}`,
				)
			}
		}
		return
	}

	// Single environment rotation
	const environmentName =
		environmentNameArg ||
		(await deps.chooseEnvironmentPrompt(
			"What environment do you want to rotate the data key for?",
		))

	const validation = deps.validateEnvironmentName(environmentName)
	if (!validation.valid) {
		deps.logError(`${chalk.red("Error:")} ${validation.reason}`)
		deps.exit(1)
	}

	const targetDir = deps.cwd()
	const targetFilePath = path.join(targetDir, `.env.${environmentName}.enc`)

	if (!deps.existsSync(targetFilePath)) {
		deps.logError(
			`${chalk.red("Error:")} environment ${chalk.cyan(environmentName)} not found.`,
		)
		deps.exit(1)
	}

	let currentContent!: string
	try {
		const envJson = await deps.getEnvironmentByPath(targetFilePath)
		currentContent = await deps.decryptEnvironmentData(environmentName, envJson)
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment.",
		)
		deps.exit(1)
	}

	try {
		await deps.encryptEnvironment(environmentName, currentContent, {
			baseDir: targetDir,
		})
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		deps.exit(1)
	}

	deps.log(`Data key for ${environmentName} has been rotated.`)
}

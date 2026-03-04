import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import chalk from "chalk"
import { buildAncestorChain } from "../helpers/buildAncestorChain"
import { decryptEnvironmentData } from "../helpers/decryptEnvironment"
import { getEnvironmentByPath } from "../helpers/getEnvironmentByPath"
import { parseEnv } from "../helpers/parseEnv"
import { resolveProjectRoot } from "../helpers/resolveProjectRoot"
import { validateEnvironmentName } from "../helpers/validateEnvironmentName"

type Options = {
	env?: string
	strict?: boolean
	localOnly?: boolean
}

type RunCommandDeps = {
	decryptEnvironmentData: typeof decryptEnvironmentData
	getEnvironmentByPath: typeof getEnvironmentByPath
	buildAncestorChain: typeof buildAncestorChain
	resolveProjectRoot: typeof resolveProjectRoot
	parseEnv: typeof parseEnv
	validateEnvironmentName: typeof validateEnvironmentName
	spawn: typeof spawn
	existsSync: typeof existsSync
	cwd: () => string
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultRunCommandDeps: RunCommandDeps = {
	decryptEnvironmentData,
	getEnvironmentByPath,
	buildAncestorChain,
	resolveProjectRoot,
	parseEnv,
	validateEnvironmentName,
	spawn,
	existsSync,
	cwd: () => process.cwd(),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

export const runCommand = async (
	command: string,
	args: string[],
	options: Options,
	_command?: unknown,
	deps: RunCommandDeps = defaultRunCommandDeps,
) => {
	// Get the environment
	const environmentName = options.env || process.env.DOTENC_ENV

	if (!environmentName) {
		deps.logError(
			'No environment provided. Use -e or set DOTENC_ENV to the environment you want to run the command in.\nTo initialize dotenc, run "dotenc init --name <your-name>". To add environments later, use "dotenc env create <environment>".',
		)
		deps.exit(1)
	}

	const environments = environmentName.split(",")

	for (const env of environments) {
		const validation = deps.validateEnvironmentName(env)
		if (!validation.valid) {
			deps.logError(`${chalk.red("Error:")} ${validation.reason}`)
			deps.exit(1)
		}
	}

	// Determine search directories
	const invocationDir = deps.cwd()
	let dirs: string[]

	if (options.localOnly) {
		dirs = [invocationDir]
	} else {
		let projectRoot: string
		try {
			projectRoot = deps.resolveProjectRoot(invocationDir, deps.existsSync)
		} catch (error) {
			deps.logError(
				error instanceof Error
					? error.message
					: "Failed to locate project root.",
			)
			deps.exit(1)
		}
		dirs = deps.buildAncestorChain(projectRoot, invocationDir)
	}

	let failureCount = 0
	const decryptedEnvs = await Promise.all(
		environments.map(async (envName) => {
			// Merge across ancestor chain: root → local (later/deeper wins)
			let merged: Record<string, string> = {}
			let foundAtAnyLevel = false

			for (const dir of dirs) {
				const filePath = path.join(dir, `.env.${envName}.enc`)
				if (!deps.existsSync(filePath)) {
					// Missing at this level is fine — continue up the chain
					continue
				}

				foundAtAnyLevel = true

				let content: string
				try {
					const envJson = await deps.getEnvironmentByPath(filePath)
					content = await deps.decryptEnvironmentData(envName, envJson)
				} catch (error: unknown) {
					deps.logError(
						error instanceof Error
							? error.message
							: `Unknown error occurred while decrypting the environment ${envName} at ${dir}.`,
					)
					failureCount++
					return {}
				}

				const vars = deps.parseEnv(content)
				merged = { ...merged, ...vars }
			}

			if (!foundAtAnyLevel) {
				deps.logError(
					`${chalk.yellow("Warning:")} environment ${chalk.cyan(envName)} not found.`,
				)
				failureCount++
				return {}
			}

			return merged
		}),
	)

	if (failureCount === environments.length) {
		deps.logError(`${chalk.red("Error:")} All environments failed to load.`)
		deps.exit(1)
	}

	if (failureCount > 0) {
		if (options.strict) {
			deps.logError(
				`${chalk.red("Error:")} ${failureCount} of ${environments.length} environment(s) failed to load and strict mode is enabled.`,
			)
			deps.exit(1)
		}

		deps.logError(
			`${chalk.yellow("Warning:")} ${failureCount} of ${environments.length} environment(s) failed to load.`,
		)
	}

	const decryptedEnv = decryptedEnvs.reduce((acc, env) => {
		return { ...acc, ...env }
	}, {})

	// Merge the environment variables and run the command.
	// Strip DOTENC_PRIVATE_KEY so it is never exposed to child processes.
	const { DOTENC_PRIVATE_KEY: _privateKey, ...baseEnv } = process.env
	const mergedEnv = { ...baseEnv, ...decryptedEnv }

	const child = deps.spawn(command, args, {
		env: mergedEnv,
		stdio: "inherit",
	})

	child.on("exit", (code) => {
		deps.exit(code ?? 0)
	})
}

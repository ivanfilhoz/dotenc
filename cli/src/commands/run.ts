import { spawn } from "node:child_process"
import chalk from "chalk"
import { decryptEnvironment } from "../helpers/decryptEnvironment"
import { parseEnv } from "../helpers/parseEnv"
import { validateEnvironmentName } from "../helpers/validateEnvironmentName"

type Options = {
	env?: string
	strict?: boolean
}

type RunCommandDeps = {
	decryptEnvironment: typeof decryptEnvironment
	parseEnv: typeof parseEnv
	validateEnvironmentName: typeof validateEnvironmentName
	spawn: typeof spawn
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultRunCommandDeps: RunCommandDeps = {
	decryptEnvironment,
	parseEnv,
	validateEnvironmentName,
	spawn,
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

	let failureCount = 0
	const decryptedEnvs = await Promise.all(
		environments.map(async (environment) => {
			let content: string
			try {
				content = await deps.decryptEnvironment(environment)
			} catch (error: unknown) {
				deps.logError(
					error instanceof Error
						? error.message
						: `Unknown error occurred while decrypting the environment ${environment}.`,
				)
				failureCount++
				return {}
			}
			const decryptedEnv = deps.parseEnv(content)
			return decryptedEnv
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

	// Merge the environment variables and run the command
	const mergedEnv = { ...process.env, ...decryptedEnv }

	const child = deps.spawn(command, args, {
		env: mergedEnv,
		stdio: "inherit",
	})

	child.on("exit", (code) => {
		deps.exit(code ?? 0)
	})
}

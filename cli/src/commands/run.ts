import { spawn } from "node:child_process"
import chalk from "chalk"
import { decryptEnvironment } from "../helpers/decryptEnvironment"
import { parseEnv } from "../helpers/parseEnv"
import { validateEnvironmentName } from "../helpers/validateEnvironmentName"

type Options = {
	env: string
}

export const runCommand = async (
	command: string,
	args: string[],
	options: Options,
) => {
	// Get the environment
	const environmentName = options.env || process.env.DOTENC_ENV

	if (!environmentName) {
		console.error(
			'No environment provided. Use -e or set DOTENC_ENV to the environment you want to run the command in.\nTo start a new environment, use "dotenc init [environment]".',
		)
		process.exit(1)
	}

	const environments = environmentName.split(",")

	for (const env of environments) {
		const validation = validateEnvironmentName(env)
		if (!validation.valid) {
			console.error(`${chalk.red("Error:")} ${validation.reason}`)
			process.exit(1)
		}
	}

	let failureCount = 0
	const decryptedEnvs = await Promise.all(
		environments.map(async (environment) => {
			let content: string
			try {
				content = await decryptEnvironment(environment)
			} catch (error: unknown) {
				console.error(
					error instanceof Error
						? error.message
						: `Unknown error occurred while decrypting the environment ${environment}.`,
				)
				failureCount++
				return {}
			}
			const decryptedEnv = parseEnv(content)
			return decryptedEnv
		}),
	)

	if (failureCount === environments.length) {
		console.error(`${chalk.red("Error:")} All environments failed to load.`)
		process.exit(1)
	}

	if (failureCount > 0) {
		console.error(
			`${chalk.yellow("Warning:")} ${failureCount} of ${environments.length} environment(s) failed to load.`,
		)
	}

	const decryptedEnv = decryptedEnvs.reduce((acc, env) => {
		return { ...acc, ...env }
	}, {})

	// Merge the environment variables and run the command
	const mergedEnv = { ...process.env, ...decryptedEnv }

	const child = spawn(command, args, {
		env: mergedEnv,
		stdio: "inherit",
	})

	child.on("exit", (code) => {
		process.exit(code)
	})
}

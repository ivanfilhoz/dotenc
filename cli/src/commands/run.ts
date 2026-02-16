import { spawn } from "node:child_process"
import { decryptEnvironment } from "../helpers/decryptEnvironment"
import { parseEnv } from "../helpers/parseEnv"

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
		return
	}

	const environments = environmentName.split(",")

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
				console.error("This environment has been skipped.")
				return {}
			}
			const decryptedEnv = parseEnv(content)
			return decryptedEnv
		}),
	)

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

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { decrypt } from "../helpers/crypto"
import { getKey } from "../helpers/key"
import { parseEnv } from "../helpers/parseEnv"

type Options = {
	env: string
	test?: boolean
}

export const runCommand = async (
	command: string,
	args: string[],
	options: Options,
) => {
	// Get the environment
	const environmentArg = options.env || process.env.DOTENC_ENV

	if (!environmentArg) {
		console.error(
			'No environment provided. Use -e or set DOTENC_ENV to the environment you want to run the command in.\nTo start a new environment, use "dotenc init [environment]".',
		)
		return
	}

	const environments = environmentArg.split(",")

	const decryptedEnvs = await Promise.all(
		environments.map(async (environment) => {
			const environmentFilePath = path.join(
				process.cwd(),
				`.env.${environment}.enc`,
			)

			if (!existsSync(environmentFilePath)) {
				console.error(`Environment file not found: ${environmentFilePath}`)
				return
			}

			const key = await getKey(environment)

			const content = await decrypt(key, environmentFilePath)

			const decryptedEnv = parseEnv(content)

			return decryptedEnv
		}),
	)

	const decryptedEnv = decryptedEnvs.reduce((acc, env) => {
		return { ...acc, ...env }
	}, {})

	// Get the local environment
	let localEnv = {}

	const localEnvironmentFilePath = path.join(process.cwd(), ".env")

	if (existsSync(localEnvironmentFilePath)) {
		const localEnvContent = await fs.readFile(localEnvironmentFilePath, "utf-8")
		localEnv = parseEnv(localEnvContent)
	}

	// Merge the environment variables and run the command
	const mergedEnv = { ...process.env, ...decryptedEnv, ...localEnv }

	const child = spawn(command, args, {
		env: mergedEnv,
		stdio: "inherit",
	})

	if (!options.test) {
		child.on("exit", (code) => {
			process.exit(code)
		})
	}
}

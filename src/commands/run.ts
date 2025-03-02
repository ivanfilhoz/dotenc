import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { decrypt } from "../helpers/crypto"
import { parseEnv } from "../helpers/parseEnv"
import { getToken } from "../helpers/token"

type Options = {
	env: string
}

export const runCommand = async (
	environmentArg: string,
	command: string,
	args: string[],
) => {
	// Get the environment
	const environment = environmentArg

	const environmentFilePath = path.join(
		process.cwd(),
		`.env.${environment}.enc`,
	)

	if (!existsSync(environmentFilePath)) {
		throw new Error(`Environment file not found: ${environmentFilePath}`)
	}

	const token = await getToken(environment)

	const content = await decrypt(token, environmentFilePath)

	const decryptedEnv = parseEnv(content)

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

	child.on("exit", (code) => {
		process.exit(code)
	})
}

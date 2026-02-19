import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import chalk from "chalk"
import pkg from "../../package.json"
import { setupGitDiff } from "../helpers/setupGitDiff"
import { choosePrivateKeyPrompt } from "../prompts/choosePrivateKey"
import { inputNamePrompt } from "../prompts/inputName"
import { createCommand } from "./env/create"
import { keyAddCommand } from "./key/add"

type Options = {
	name?: string
}

export const _resolveDocsUrl = () => {
	if (typeof pkg.homepage === "string" && pkg.homepage.trim().length > 0) {
		return pkg.homepage
	}

	const repositoryUrl =
		typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url
	if (typeof repositoryUrl !== "string" || repositoryUrl.trim().length === 0) {
		return undefined
	}

	return repositoryUrl.replace(/^git\+/, "").replace(/\.git$/, "")
}

type InitCommandDeps = {
	inputNamePrompt: typeof inputNamePrompt
	userInfo: typeof os.userInfo
	choosePrivateKeyPrompt: typeof choosePrivateKeyPrompt
	createPublicKey: typeof crypto.createPublicKey
	keyAddCommand: typeof keyAddCommand
	setupGitDiff: typeof setupGitDiff
	existsSync: typeof existsSync
	readFile: typeof fs.readFile
	unlink: typeof fs.unlink
	cwd: typeof process.cwd
	createCommand: typeof createCommand
	logInfo: (message: string) => void
	logWarn: (message: string) => void
	logError: (message: string) => void
	resolveDocsUrl: typeof _resolveDocsUrl
	exit: (code: number) => never
}

const defaultDeps: InitCommandDeps = {
	inputNamePrompt,
	userInfo: os.userInfo,
	choosePrivateKeyPrompt,
	createPublicKey: crypto.createPublicKey,
	keyAddCommand,
	setupGitDiff,
	existsSync,
	readFile: fs.readFile,
	unlink: fs.unlink,
	cwd: process.cwd,
	createCommand,
	logInfo: (message) => console.log(message),
	logWarn: (message) => console.warn(message),
	logError: (message) => console.error(message),
	resolveDocsUrl: _resolveDocsUrl,
	exit: (code: number) => process.exit(code),
}

export const _runInitCommand = async (
	options: Options,
	depsOverrides: Partial<InitCommandDeps> = {},
) => {
	const deps: InitCommandDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	// Prompt for username
	const username =
		options.name ||
		(await deps.inputNamePrompt("What's your name?", deps.userInfo().username))

	if (!username) {
		deps.logError(`${chalk.red("Error:")} no name provided.`)
		deps.exit(1)
	}

	let keyEntry: Awaited<ReturnType<typeof choosePrivateKeyPrompt>>
	try {
		keyEntry = await deps.choosePrivateKeyPrompt(
			"Which SSH key would you like to use?",
		)
	} catch (error) {
		deps.logError(error instanceof Error ? error.message : String(error))
		deps.exit(1)
	}

	// Derive and add public key to the project
	deps.logInfo(`Adding key: ${chalk.cyan(username)} (${keyEntry.algorithm})`)

	const publicKey = deps.createPublicKey(keyEntry.privateKey)
	const publicKeyPem = publicKey
		.export({ type: "spki", format: "pem" })
		.toString()

	await deps.keyAddCommand(username, {
		fromString: publicKeyPem,
	})

	// Set up git diff driver for encrypted files
	try {
		deps.setupGitDiff()
	} catch (_error) {
		deps.logWarn(
			`${chalk.yellow("Warning:")} could not set up git diff driver. You can run ${chalk.gray("dotenc init")} again inside a git repository.`,
		)
	}

	// Create development + personal encrypted environments
	// If .env exists, use its contents as initial content, then delete it
	let initialContent: string | undefined
	const envPath = path.join(deps.cwd(), ".env")

	if (deps.existsSync(envPath)) {
		initialContent = await deps.readFile(envPath, "utf-8")
		await deps.unlink(envPath)
		deps.logInfo(
			`Migrated ${chalk.gray(".env")} contents to ${chalk.cyan("development")} environment.`,
		)
	}

	await deps.createCommand("development", username, initialContent)

	if (username !== "development") {
		await deps.createCommand(username, username)
	}

	// Output success message
	deps.logInfo(`\n${chalk.green("✔")} Initialization complete!`)
	deps.logInfo("\nSome useful tips:")
	const developmentEditCmd = chalk.gray("dotenc env edit development")
	const personalEditCmd = chalk.gray(`dotenc env edit ${username}`)
	deps.logInfo(`- Edit the development environment:\t${developmentEditCmd}`)
	if (username !== "development") {
		deps.logInfo(`- Edit your personal environment:\t${personalEditCmd}`)
	}

	const devEnvironmentChain =
		username === "development" ? "development" : `development,${username}`
	const devCmd = chalk.gray("dotenc dev <command>")
	deps.logInfo(
		`- Run in development mode:\t\t${devCmd} ${chalk.gray(`(loads ${devEnvironmentChain})`)}`,
	)
	const docsUrl = deps.resolveDocsUrl()
	if (docsUrl) {
		deps.logInfo(`- Full docs:\t\t\t${chalk.gray(docsUrl)}`)
	}

	// Editor integration suggestions
	if (deps.existsSync(".claude") || deps.existsSync("CLAUDE.md")) {
		deps.logInfo(
			`- Install the agent skill:\t\t${chalk.gray("dotenc tools install-agent-skill")}`,
		)
	}
	if (
		deps.existsSync(".vscode") ||
		deps.existsSync(".cursor") ||
		deps.existsSync(".windsurf")
	) {
		deps.logInfo(
			`- Add the editor extension:\t\t${chalk.gray("dotenc tools install-vscode-extension")}`,
		)
	}
}

export const initCommand = async (options: Options) => {
	return _runInitCommand(options)
}

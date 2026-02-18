import { spawn } from "node:child_process"
import chalk from "chalk"
import inquirer from "inquirer"

type Options = {
	force?: boolean
}

type Scope = "local" | "global"

type InstallAgentSkillDeps = {
	prompt: typeof inquirer.prompt
	runNpx: (args: string[]) => Promise<number>
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const SKILL_SOURCE = "ivanfilhoz/dotenc"
const SKILL_NAME = "dotenc"

const runNpx = (
	args: string[],
	spawnImpl: typeof spawn = spawn,
) =>
	new Promise<number>((resolve, reject) => {
		const child = spawnImpl("npx", args, {
			stdio: "inherit",
			shell: process.platform === "win32",
		})

		child.on("error", reject)
		child.on("exit", (code) => resolve(code ?? 1))
	})

export const _runNpx = runNpx

const defaultDeps: InstallAgentSkillDeps = {
	prompt: inquirer.prompt,
	runNpx,
	log: console.log,
	logError: console.error,
	exit: process.exit,
}

export const _runInstallAgentSkillCommand = async (
	options: Options,
	depsOverrides: Partial<InstallAgentSkillDeps> = {},
) => {
	const deps: InstallAgentSkillDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	const { scope } = (await deps.prompt([
		{
			type: "list",
			name: "scope",
			message: "Install locally or globally?",
			choices: [
				{ name: "Locally (this project)", value: "local" },
				{ name: "Globally (all projects)", value: "global" },
			],
		},
	])) as { scope: Scope }

	const args = ["skills", "add", SKILL_SOURCE, "--skill", SKILL_NAME]

	if (scope === "global") {
		args.push("-g")
	}

	// Keep backward compatibility with existing --force flag by mapping it to non-interactive mode.
	if (options.force) {
		args.push("-y")
	}

	const npxCommand = `npx ${args.join(" ")}`
	let exitCode = 0

	try {
		exitCode = await deps.runNpx(args)
	} catch (error) {
		deps.logError(
			`${chalk.red("Error:")} failed to run ${chalk.gray(npxCommand)}.`,
		)
		deps.logError(
			`${chalk.red("Details:")} ${error instanceof Error ? error.message : String(error)}`,
		)
		deps.exit(1)
	}

	if (exitCode !== 0) {
		deps.logError(
			`${chalk.red("Error:")} skill installation command exited with code ${exitCode}.`,
		)
		deps.exit(exitCode)
	}

	deps.log(
		`${chalk.green("✓")} Agent skill installation completed via ${chalk.gray(npxCommand)}.`,
	)
	deps.log(`Run ${chalk.gray("/dotenc")} in your agent to use it.`)
}

export const installAgentSkillCommand = async (options: Options) => {
	await _runInstallAgentSkillCommand(options)
}

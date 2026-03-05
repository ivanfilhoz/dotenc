import { spawn } from "node:child_process"
import chalk from "chalk"
import inquirer from "inquirer"

type Options = {
	force?: boolean
}

type Scope = "local" | "global"

const SKILL_SOURCE = "ivanfilhoz/dotenc"
const SKILL_NAME = "dotenc"

export const _runNpx = (args: string[], spawnImpl: typeof spawn = spawn) =>
	new Promise<number>((resolve, reject) => {
		const child = spawnImpl("npx", args, {
			stdio: "inherit",
			shell: process.platform === "win32",
		})

		child.on("error", reject)
		child.on("exit", (code) => resolve(code ?? 1))
	})

export const installAgentSkillCommand = async (options: Options) => {
	const { scope } = (await inquirer.prompt([
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

	if (options.force) {
		args.push("-y")
	}

	const npxCommand = `npx ${args.join(" ")}`
	let exitCode = 0

	try {
		exitCode = await _runNpx(args)
	} catch (error) {
		console.error(
			`${chalk.red("Error:")} failed to run ${chalk.gray(npxCommand)}.`,
		)
		console.error(
			`${chalk.red("Details:")} ${error instanceof Error ? error.message : String(error)}`,
		)
		process.exit(1)
	}

	if (exitCode !== 0) {
		console.error(
			`${chalk.red("Error:")} skill installation command exited with code ${exitCode}.`,
		)
		process.exit(exitCode)
	}

	console.log(
		`${chalk.green("✓")} Agent skill installation completed via ${chalk.gray(npxCommand)}.`,
	)
	console.log(`Run ${chalk.gray("/dotenc")} in your agent to use it.`)
}

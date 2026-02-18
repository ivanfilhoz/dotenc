import { spawn } from "node:child_process"
import chalk from "chalk"
import {
	detectInstallMethod,
	GITHUB_RELEASES_URL,
	type InstallMethod,
} from "../helpers/update"

type UpdateCommandDeps = {
	detectInstallMethod: () => InstallMethod
	runPackageManagerCommand: (command: string, args: string[]) => Promise<number>
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const runPackageManagerCommand = (command: string, args: string[]) =>
	new Promise<number>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: process.platform === "win32",
		})

		child.on("error", reject)
		child.on("exit", (code) => resolve(code ?? 1))
	})

const defaultDeps: UpdateCommandDeps = {
	detectInstallMethod,
	runPackageManagerCommand,
	log: console.log,
	logError: console.error,
	exit: process.exit,
}

const updateCommands: Record<
	Extract<InstallMethod, "homebrew" | "scoop" | "npm">,
	{ command: string; args: string[]; label: string }
> = {
	homebrew: {
		command: "brew",
		args: ["upgrade", "dotenc"],
		label: "Homebrew",
	},
	scoop: {
		command: "scoop",
		args: ["update", "dotenc"],
		label: "Scoop",
	},
	npm: {
		command: "npm",
		args: ["install", "-g", "@dotenc/cli"],
		label: "npm",
	},
}

export const _runUpdateCommand = async (
	depsOverrides: Partial<UpdateCommandDeps> = {},
) => {
	const deps: UpdateCommandDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	const method = deps.detectInstallMethod()

	if (method === "binary") {
		deps.log(
			`Standalone binary detected. Download the latest release at ${chalk.cyan(GITHUB_RELEASES_URL)}.`,
		)
		return
	}

	if (method === "unknown") {
		deps.log("Could not determine installation method automatically.")
		deps.log(`Try one of these commands:`)
		deps.log(`  ${chalk.gray("brew upgrade dotenc")}`)
		deps.log(`  ${chalk.gray("scoop update dotenc")}`)
		deps.log(`  ${chalk.gray("npm install -g @dotenc/cli")}`)
		deps.log(`Or download from ${chalk.cyan(GITHUB_RELEASES_URL)}.`)
		return
	}

	const updater = updateCommands[method]
	deps.log(`Updating dotenc via ${updater.label}...`)

	let exitCode = 0
	try {
		exitCode = await deps.runPackageManagerCommand(
			updater.command,
			updater.args,
		)
	} catch (error) {
		deps.logError(
			`${chalk.red("Error:")} failed to run ${chalk.gray([updater.command, ...updater.args].join(" "))}.`,
		)
		deps.logError(
			`${chalk.red("Details:")} ${error instanceof Error ? error.message : String(error)}`,
		)
		deps.exit(1)
	}

	if (exitCode !== 0) {
		deps.logError(
			`${chalk.red("Error:")} update command exited with code ${exitCode}.`,
		)
		deps.exit(exitCode)
	}
}

export const updateCommand = async () => {
	await _runUpdateCommand()
}

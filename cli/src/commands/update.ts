import { spawn } from "node:child_process"
import chalk from "chalk"
import {
	detectInstallMethod,
	GITHUB_RELEASES_URL,
	type InstallMethod,
} from "../helpers/update"

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

export const _runPackageManagerCommand = (
	command: string,
	args: string[],
	spawnImpl: typeof spawn = spawn,
) =>
	new Promise<number>((resolve, reject) => {
		const child = spawnImpl(command, args, {
			stdio: "inherit",
			shell: process.platform === "win32",
		})

		child.on("error", reject)
		child.on("exit", (code) => resolve(code ?? 1))
	})

export const updateCommand = async () => {
	const method = detectInstallMethod()

	if (method === "binary") {
		console.log(
			`Standalone binary detected. Download the latest release at ${chalk.cyan(GITHUB_RELEASES_URL)}.`,
		)
		return
	}

	if (method === "unknown") {
		console.log("Could not determine installation method automatically.")
		console.log(`Try one of these commands:`)
		console.log(`  ${chalk.gray("brew update && brew upgrade dotenc")}`)
		console.log(`  ${chalk.gray("scoop update dotenc")}`)
		console.log(`  ${chalk.gray("npm install -g @dotenc/cli")}`)
		console.log(`Or download from ${chalk.cyan(GITHUB_RELEASES_URL)}.`)
		return
	}

	const updater = updateCommands[method]
	console.log(`Updating dotenc via ${updater.label}...`)

	if (method === "homebrew") {
		try {
			const brewUpdateCode = await _runPackageManagerCommand("brew", ["update"])

			if (brewUpdateCode !== 0) {
				console.error(
					`${chalk.red("Error:")} update command exited with code ${brewUpdateCode}.`,
				)
				process.exit(brewUpdateCode)
			}
		} catch (error) {
			console.error(
				`${chalk.red("Error:")} failed to run ${chalk.gray("brew update")}.`,
			)
			console.error(
				`${chalk.red("Details:")} ${error instanceof Error ? error.message : String(error)}`,
			)
			process.exit(1)
		}
	}

	let exitCode = 0
	try {
		exitCode = await _runPackageManagerCommand(updater.command, updater.args)
	} catch (error) {
		console.error(
			`${chalk.red("Error:")} failed to run ${chalk.gray([updater.command, ...updater.args].join(" "))}.`,
		)
		console.error(
			`${chalk.red("Details:")} ${error instanceof Error ? error.message : String(error)}`,
		)
		process.exit(1)
	}

	if (exitCode !== 0) {
		console.error(
			`${chalk.red("Error:")} update command exited with code ${exitCode}.`,
		)
		process.exit(exitCode)
	}
}

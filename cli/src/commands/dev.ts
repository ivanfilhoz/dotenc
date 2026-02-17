import chalk from "chalk"
import { getCurrentKeyName } from "../helpers/getCurrentKeyName"
import { runCommand } from "./run"

type DevCommandDeps = {
	getCurrentKeyName: typeof getCurrentKeyName
	runCommand: typeof runCommand
	logError: (message: string) => void
	exit: (code: number) => never
}

export const devCommand = async (
	command: string,
	args: string[],
	deps: DevCommandDeps = {
		getCurrentKeyName,
		runCommand,
		logError: (message) => console.error(message),
		exit: (code) => process.exit(code),
	},
) => {
	const keyName = await deps.getCurrentKeyName()

	if (!keyName) {
		deps.logError(
			`${chalk.red("Error:")} could not resolve your identity. Run ${chalk.gray("dotenc init")} first.`,
		)
		deps.exit(1)
	}

	await deps.runCommand(command, args, { env: `development,${keyName}` })
}

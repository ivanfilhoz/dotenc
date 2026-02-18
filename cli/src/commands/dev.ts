import chalk from "chalk"
import inquirer from "inquirer"
import { getCurrentKeyName } from "../helpers/getCurrentKeyName"
import { runCommand } from "./run"

type DevCommandDeps = {
	getCurrentKeyName: typeof getCurrentKeyName
	runCommand: typeof runCommand
	logError: (message: string) => void
	exit: (code: number) => never
	select: <T>(
		message: string,
		choices: { name: string; value: T }[],
	) => Promise<T>
}

const defaultSelect = async <T>(
	message: string,
	choices: { name: string; value: T }[],
): Promise<T> => {
	const { selected } = await inquirer.prompt([
		{
			type: "list",
			name: "selected",
			message,
			choices,
		},
	])
	return selected as T
}

const defaultDevCommandDeps: DevCommandDeps = {
	getCurrentKeyName,
	runCommand,
	logError: console.error,
	exit: process.exit as (code: number) => never,
	select: defaultSelect,
}

export const devCommand = async (
	command: string,
	args: string[],
	deps: DevCommandDeps = defaultDevCommandDeps,
) => {
	const keyNames = await deps.getCurrentKeyName()

	if (keyNames.length === 0) {
		deps.logError(
			`${chalk.red("Error:")} could not resolve your identity. Run ${chalk.gray("dotenc init")} first.`,
		)
		deps.exit(1)
	}

	let keyName: string

	if (keyNames.length === 1) {
		keyName = keyNames[0]
	} else {
		keyName = await deps.select(
			"Multiple identities found. Which one do you want to use?",
			keyNames.map((name) => ({ name, value: name })),
		)
	}

	await deps.runCommand(command, args, { env: `development,${keyName}` })
}

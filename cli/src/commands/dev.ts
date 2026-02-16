import chalk from "chalk"
import { getCurrentKeyName } from "../helpers/getCurrentKeyName"
import { runCommand } from "./run"

export const devCommand = async (command: string, args: string[]) => {
	const keyName = await getCurrentKeyName()

	if (!keyName) {
		console.error(
			`${chalk.red("Error:")} could not resolve your identity. Run ${chalk.gray("dotenc init")} first.`,
		)
		return
	}

	await runCommand(command, args, { env: `development,${keyName}` })
}

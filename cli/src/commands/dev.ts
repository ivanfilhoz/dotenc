import chalk from "chalk"
import inquirer from "inquirer"
import { getCurrentKeyName } from "../helpers/getCurrentKeyName"
import { runCommand } from "./run"

export const devCommand = async (
	command: string,
	args: string[],
	options: { localOnly?: boolean } = {},
) => {
	const keyNames = await getCurrentKeyName()

	if (keyNames.length === 0) {
		console.error(
			`${chalk.red("Error:")} could not resolve your identity. Run ${chalk.gray("dotenc init")} first.`,
		)
		process.exit(1)
	}

	let keyName: string

	if (keyNames.length === 1) {
		keyName = keyNames[0]
	} else {
		const { selected } = await inquirer.prompt([
			{
				type: "list",
				name: "selected",
				message: "Multiple identities found. Which one do you want to use?",
				choices: keyNames.map((name) => ({ name, value: name })),
			},
		])
		keyName = selected as string
	}

	await runCommand(command, args, {
		env: `development,${keyName}`,
		localOnly: options.localOnly,
	})
}

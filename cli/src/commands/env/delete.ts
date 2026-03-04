import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"
import { confirmPrompt } from "../../prompts/confirm"

export const envDeleteCommand = async (
	environmentNameArg: string,
	yes: boolean,
) => {
	const environmentName =
		environmentNameArg ||
		(await chooseEnvironmentPrompt(
			"Which environment do you want to delete?",
		))

	const validation = validateEnvironmentName(environmentName)
	if (!validation.valid) {
		console.error(`${chalk.red("Error:")} ${validation.reason}`)
		process.exit(1)
	}

	const filePath = path.join(process.cwd(), `.env.${environmentName}.enc`)

	if (!existsSync(filePath)) {
		console.error(`Environment ${chalk.cyan(environmentName)} not found.`)
		process.exit(1)
	}

	if (!yes) {
		const confirmed = await confirmPrompt(
			`Are you sure you want to delete environment ${environmentName}?`,
		)
		if (!confirmed) {
			console.log("Operation cancelled.")
			return
		}
	}

	await fs.unlink(filePath)
	console.log(`Environment ${chalk.cyan(environmentName)} deleted.`)
}

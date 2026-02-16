import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"

export const keyRemoveCommand = async (nameArg: string) => {
	let name = nameArg

	if (!name) {
		name = await choosePublicKeyPrompt(
			"Which public key do you want to remove?",
		)
	}

	const filePath = path.join(process.cwd(), ".dotenc", `${name}.pub`)
	if (!existsSync(filePath)) {
		console.error(`Public key ${chalk.cyan(name)} not found.`)
		process.exit(1)
	}

	await fs.unlink(filePath)
	console.log(`Public key ${chalk.cyan(name)} removed successfully.`)
}

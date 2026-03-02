import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import chalk from "chalk"
import { validateKeyName } from "../../helpers/validateKeyName"
import { choosePublicKeyPrompt } from "../../prompts/choosePublicKey"
import { confirmPrompt } from "../../prompts/confirm"

export type KeyRemoveCommandDeps = {
	validateKeyName: typeof validateKeyName
	choosePublicKeyPrompt: typeof choosePublicKeyPrompt
	confirmPrompt: typeof confirmPrompt
	existsSync: typeof existsSync
	unlink: typeof fs.unlink
	cwd: () => string
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultKeyRemoveCommandDeps: KeyRemoveCommandDeps = {
	validateKeyName,
	choosePublicKeyPrompt,
	confirmPrompt,
	existsSync,
	unlink: fs.unlink,
	cwd: () => process.cwd(),
	log: (message) => console.log(message),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

const isKeyRemoveCommandDeps = (
	value: unknown,
): value is KeyRemoveCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"validateKeyName" in value &&
		"choosePublicKeyPrompt" in value &&
		"confirmPrompt" in value &&
		"existsSync" in value &&
		"unlink" in value &&
		"cwd" in value &&
		"log" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const keyRemoveCommand = async (
	nameArg: string,
	commandOrDeps?: unknown,
) => {
	const deps = isKeyRemoveCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultKeyRemoveCommandDeps

	let name = nameArg

	if (!name) {
		name = await deps.choosePublicKeyPrompt(
			"Which public key do you want to remove?",
		)
	}

	const keyNameValidation = deps.validateKeyName(name)
	if (!keyNameValidation.valid) {
		deps.logError(`${chalk.red("Error:")} ${keyNameValidation.reason}`)
		deps.exit(1)
	}

	const filePath = path.join(deps.cwd(), ".dotenc", `${name}.pub`)
	if (!deps.existsSync(filePath)) {
		deps.logError(`Public key ${chalk.cyan(name)} not found.`)
		deps.exit(1)
	}

	const confirmed = await deps.confirmPrompt(
		`Are you sure you want to remove key ${name}?`,
	)
	if (!confirmed) {
		deps.log("Operation cancelled.")
		return
	}

	await deps.unlink(filePath)
	deps.log(`Public key ${chalk.cyan(name)} removed.`)
	deps.log(
		`To fully offboard this key, run: ${chalk.gray(`dotenc auth purge ${name}`)}`,
	)
}

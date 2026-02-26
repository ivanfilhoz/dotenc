import chalk from "chalk"
import { decryptEnvironment } from "../../helpers/decryptEnvironment"
import { encryptEnvironment } from "../../helpers/encryptEnvironment"
import { validateEnvironmentName } from "../../helpers/validateEnvironmentName"
import { chooseEnvironmentPrompt } from "../../prompts/chooseEnvironment"

export type RotateCommandDeps = {
	decryptEnvironment: typeof decryptEnvironment
	encryptEnvironment: typeof encryptEnvironment
	validateEnvironmentName: typeof validateEnvironmentName
	chooseEnvironmentPrompt: typeof chooseEnvironmentPrompt
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultRotateCommandDeps: RotateCommandDeps = {
	decryptEnvironment,
	encryptEnvironment,
	validateEnvironmentName,
	chooseEnvironmentPrompt,
	log: (message) => console.log(message),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

const isRotateCommandDeps = (value: unknown): value is RotateCommandDeps => {
	return (
		typeof value === "object" &&
		value !== null &&
		"decryptEnvironment" in value &&
		"encryptEnvironment" in value &&
		"validateEnvironmentName" in value &&
		"chooseEnvironmentPrompt" in value &&
		"log" in value &&
		"logError" in value &&
		"exit" in value
	)
}

export const rotateCommand = async (
	environmentNameArg: string,
	commandOrDeps?: unknown,
) => {
	const deps = isRotateCommandDeps(commandOrDeps)
		? commandOrDeps
		: defaultRotateCommandDeps

	const environmentName =
		environmentNameArg ||
		(await deps.chooseEnvironmentPrompt(
			"What environment do you want to rotate the data key for?",
		))

	const validation = deps.validateEnvironmentName(environmentName)
	if (!validation.valid) {
		deps.logError(`${chalk.red("Error:")} ${validation.reason}`)
		deps.exit(1)
	}

	let currentContent!: string
	try {
		currentContent = await deps.decryptEnvironment(environmentName)
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while decrypting the environment.",
		)
		deps.exit(1)
	}

	try {
		await deps.encryptEnvironment(environmentName, currentContent)
	} catch (error) {
		deps.logError(
			error instanceof Error
				? error.message
				: "Unknown error occurred while encrypting the environment.",
		)
		deps.exit(1)
	}

	deps.log(`Data key for ${environmentName} has been rotated.`)
}

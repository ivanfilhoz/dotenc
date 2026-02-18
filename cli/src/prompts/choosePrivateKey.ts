import path from "node:path"
import chalk from "chalk"
import inquirer from "inquirer"
import { createEd25519SshKey } from "../helpers/createEd25519SshKey"
import {
	getPrivateKeys,
	type PrivateKeyEntry,
	type UnsupportedPrivateKeyEntry,
} from "../helpers/getPrivateKeys"

export const CREATE_NEW_PRIVATE_KEY_CHOICE = "__dotenc_create_new_private_key__"

type PromptChoice = {
	name: string
	value: string
	disabled?: boolean
}

type ChoosePrivateKeyPromptDeps = {
	getPrivateKeys: typeof getPrivateKeys
	prompt: typeof inquirer.prompt
	createEd25519SshKey: typeof createEd25519SshKey
	logInfo: (message: string) => void
	logWarn: (message: string) => void
}

const defaultChoosePrivateKeyPromptDeps: ChoosePrivateKeyPromptDeps = {
	getPrivateKeys,
	prompt: inquirer.prompt,
	createEd25519SshKey,
	logInfo: console.log,
	logWarn: console.warn,
}

function toSupportedChoice(key: PrivateKeyEntry): PromptChoice {
	return {
		name: `${key.name} (${key.algorithm})`,
		value: key.name,
	}
}

function toUnsupportedChoice(
	key: UnsupportedPrivateKeyEntry,
	index: number,
): PromptChoice {
	return {
		name: `${chalk.gray(key.name)} (${chalk.yellow(key.reason)})`,
		value: `__unsupported_${index}__`,
		disabled: true,
	}
}

const buildPromptChoices = (
	keys: PrivateKeyEntry[],
	unsupportedKeys: UnsupportedPrivateKeyEntry[],
): PromptChoice[] => {
	const choices: PromptChoice[] = keys.map(toSupportedChoice)

	if (unsupportedKeys.length > 0) {
		if (choices.length > 0) {
			choices.push({
				name: chalk.gray("────────"),
				value: "__separator_supported_unsupported__",
				disabled: true,
			})
		}

		choices.push({
			name: chalk.gray("Unsupported keys (ignored)"),
			value: "__unsupported_header__",
			disabled: true,
		})

		choices.push(...unsupportedKeys.map(toUnsupportedChoice))
	}

	if (choices.length > 0) {
		choices.push({
			name: chalk.gray("────────"),
			value: "__separator_create__",
			disabled: true,
		})
	}

	choices.push({
		name: "Create a new SSH key (ed25519, recommended)",
		value: CREATE_NEW_PRIVATE_KEY_CHOICE,
	})

	return choices
}

export const _runChoosePrivateKeyPrompt = async (
	message: string,
	deps: ChoosePrivateKeyPromptDeps = defaultChoosePrivateKeyPromptDeps,
): Promise<PrivateKeyEntry> => {
	for (;;) {
		const { keys, unsupportedKeys = [] } = await deps.getPrivateKeys()
		const privateKeyMap = new Map(keys.map((key) => [key.name, key]))

		const result = await deps.prompt([
			{
				type: "list",
				name: "key",
				message,
				choices: buildPromptChoices(keys, unsupportedKeys),
			},
		])

		const selected = String(result.key || "")

		if (selected === CREATE_NEW_PRIVATE_KEY_CHOICE) {
			try {
				const createdPath = await deps.createEd25519SshKey()
				deps.logInfo(
					`${chalk.green("✔")} Created ${chalk.cyan(path.basename(createdPath))} at ${chalk.gray(createdPath)}.`,
				)
			} catch (error) {
				deps.logWarn(
					`${chalk.yellow("Warning:")} failed to create a new SSH key. ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			continue
		}

		const selectedKey = privateKeyMap.get(selected)
		if (selectedKey) {
			return selectedKey
		}
	}
}

export const choosePrivateKeyPrompt = async (message: string) =>
	_runChoosePrivateKeyPrompt(message)

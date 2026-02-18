import inquirer from "inquirer"
import { getPublicKeys } from "../helpers/getPublicKeys"

type ChoosePublicKeyPromptDeps = {
	prompt: typeof inquirer.prompt
	getPublicKeys: typeof getPublicKeys
}

const defaultDeps: ChoosePublicKeyPromptDeps = {
	prompt: inquirer.prompt,
	getPublicKeys,
}

export async function _runChoosePublicKeyPrompt(
	message: string,
	multiple: true,
	depsOverrides?: Partial<ChoosePublicKeyPromptDeps>,
): Promise<string[]>
export async function _runChoosePublicKeyPrompt(
	message: string,
	multiple?: false,
	depsOverrides?: Partial<ChoosePublicKeyPromptDeps>,
): Promise<string>
export async function _runChoosePublicKeyPrompt(
	message: string,
	multiple?: boolean,
	depsOverrides: Partial<ChoosePublicKeyPromptDeps> = {},
): Promise<string | string[]> {
	const deps: ChoosePublicKeyPromptDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	const publicKeys = await deps.getPublicKeys()

	const result = (await deps.prompt([
		{
			type: multiple ? "checkbox" : "list",
			name: "key",
			message,
			choices: publicKeys.map((key) => key.name.replace(".pub", "")),
			validate: (input: unknown) => {
				if (!multiple) {
					return true
				}

				if (Array.isArray(input) && input.length > 0) {
					return true
				}

				return "Select at least one public key."
			},
		},
	] as any)) as { key: string | string[] }

	if (multiple) {
		return Array.isArray(result.key) ? result.key : [result.key]
	}

	if (Array.isArray(result.key)) {
		return result.key[0] ?? ""
	}

	return result.key
}

export async function choosePublicKeyPrompt(
	message: string,
	multiple: true,
): Promise<string[]>
export async function choosePublicKeyPrompt(
	message: string,
	multiple?: false,
): Promise<string>
export async function choosePublicKeyPrompt(
	message: string,
	multiple?: boolean,
): Promise<string | string[]> {
	if (multiple) {
		return _runChoosePublicKeyPrompt(message, true)
	}
	return _runChoosePublicKeyPrompt(message, false)
}

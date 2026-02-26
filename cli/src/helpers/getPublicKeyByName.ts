import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { validateKeyName } from "./validateKeyName"

export const getPublicKeyByName = async (name: string) => {
	const keyNameValidation = validateKeyName(name)
	if (!keyNameValidation.valid) {
		throw new Error(keyNameValidation.reason)
	}

	const filePath = path.join(process.cwd(), ".dotenc", `${name}.pub`)
	let publicKeyInput: string

	try {
		publicKeyInput = await fs.readFile(filePath, "utf-8")
	} catch (error) {
		throw new Error(`No public key found with name ${name}.`, {
			cause: error,
		})
	}

	try {
		return crypto.createPublicKey(publicKeyInput)
	} catch (error) {
		throw new Error(
			`Invalid public key format for ${name}. Please provide a valid PEM formatted public key.`,
			{ cause: error },
		)
	}
}

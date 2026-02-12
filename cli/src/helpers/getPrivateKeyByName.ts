import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const getPrivateKeyByName = async (name: string) => {
	const filePath = path.join(os.homedir(), ".dotenc", `${name}.pem`)
	let privateKeyInput: string

	try {
		await fs.access(filePath)
		privateKeyInput = await fs.readFile(filePath, "utf-8")
	} catch (error) {
		throw new Error(`No private key found with name ${name}.`, {
			cause: error,
		})
	}

	try {
		return crypto.createPrivateKey(privateKeyInput)
	} catch (error) {
		throw new Error(
			`Invalid private key format for ${name}. Please provide a valid PEM formatted private key.`,
			{ cause: error },
		)
	}
}

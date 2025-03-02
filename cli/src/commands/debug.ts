import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { decrypt, encrypt } from "../helpers/crypto"

export const debugCommand = async () => {
	const token = crypto.randomBytes(32).toString("base64")

	const encryptedFilePath = path.join(os.tmpdir(), "dotenc.enc")

	await encrypt(token, "Test", encryptedFilePath)
	const content = await decrypt(token, encryptedFilePath)

	await fs.unlink(encryptedFilePath)

	if (content !== "Test") {
		throw new Error("Decrypted content is not equal to the original content")
	}

	console.log("Decryption successful")
}

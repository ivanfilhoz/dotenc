import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getKeyFingerprint } from "./getKeyFingerprint"

export const getPrivateKeys = async () => {
	if (!existsSync(path.join(os.homedir(), ".dotenc"))) {
		return []
	}

	const files = await fs.readdir(path.join(os.homedir(), ".dotenc"))

	const privateKeys: {
		name: string
		privateKey: crypto.KeyObject
		fingerprint: string
	}[] = []

	if (process.env.DOTENC_PRIVATE_KEY) {
		try {
			const privateKey = crypto.createPrivateKey(process.env.DOTENC_PRIVATE_KEY)
			privateKeys.push({
				name: "env.DOTENC_PRIVATE_KEY",
				privateKey,
				fingerprint: getKeyFingerprint(privateKey),
			})
		} catch (error: unknown) {
			console.error(
				`Invalid private key format in DOTENC_PRIVATE_KEY environment variable. Please provide a valid PEM formatted private key.`,
			)
			console.error(
				`Details: ${error instanceof Error ? error.message : error}`,
			)
			return []
		}
	}

	for (const fileName of files) {
		if (!fileName.endsWith(".pem")) {
			continue
		}

		const keyInput = await fs.readFile(
			path.join(os.homedir(), ".dotenc", fileName),
			"utf-8",
		)
		let privateKey: crypto.KeyObject
		try {
			privateKey = crypto.createPrivateKey(keyInput)
		} catch (error: unknown) {
			console.error(
				`Invalid private key format in ${fileName}. Please provide a valid PEM formatted private key.`,
			)
			console.error(
				`Details: ${error instanceof Error ? error.message : error}`,
			)
			continue
		}

		privateKeys.push({
			name: fileName.replace(".pem", ""),
			privateKey,
			fingerprint: getKeyFingerprint(privateKey),
		})
	}

	return privateKeys
}

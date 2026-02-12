import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { getKeyFingerprint } from "./getKeyFingerprint"

export const getPublicKeys = async () => {
	if (!existsSync(path.join(process.cwd(), ".dotenc"))) {
		return []
	}

	const files = await fs.readdir(path.join(process.cwd(), ".dotenc"))

	const publicKeys: {
		name: string
		publicKey: crypto.KeyObject
		fingerprint: string
	}[] = []
	for (const fileName of files) {
		if (!fileName.endsWith(".pub")) {
			continue
		}

		const keyInput = await fs.readFile(
			path.join(process.cwd(), ".dotenc", fileName),
			"utf-8",
		)
		let publicKey: crypto.KeyObject
		try {
			publicKey = crypto.createPublicKey(keyInput)
		} catch (error: unknown) {
			console.error(
				`Invalid public key format in ${fileName}. Please provide a valid PEM formatted public key.`,
			)
			console.error(
				`Details: ${error instanceof Error ? error.message : error}`,
			)
			continue
		}

		publicKeys.push({
			name: fileName.replace(".pub", ""),
			publicKey,
			fingerprint: getKeyFingerprint(publicKey),
		})
	}

	return publicKeys
}

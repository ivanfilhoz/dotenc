import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { getKeyFingerprint } from "./getKeyFingerprint"

export type PublicKeyEntry = {
	name: string
	publicKey: crypto.KeyObject
	fingerprint: string
	algorithm: "rsa" | "ed25519"
	rawPublicKey?: Buffer
}

function detectAlgorithm(
	publicKey: crypto.KeyObject,
): "rsa" | "ed25519" | null {
	const keyType = publicKey.asymmetricKeyType
	if (keyType === "rsa") return "rsa"
	if (keyType === "ed25519") return "ed25519"
	return null
}

function extractEd25519RawPublicKey(publicKey: crypto.KeyObject): Buffer {
	const pubDer = publicKey.export({ type: "spki", format: "der" })
	return Buffer.from(pubDer.subarray(pubDer.length - 32))
}

export const getPublicKeys = async (baseDir?: string) => {
	const dir = baseDir ?? process.cwd()

	if (!existsSync(path.join(dir, ".dotenc"))) {
		return []
	}

	const files = await fs.readdir(path.join(dir, ".dotenc"))

	const publicKeys: PublicKeyEntry[] = []
	for (const fileName of files) {
		if (!fileName.endsWith(".pub")) {
			continue
		}

		const keyInput = await fs.readFile(
			path.join(dir, ".dotenc", fileName),
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

		const algorithm = detectAlgorithm(publicKey)
		if (!algorithm) {
			console.error(
				`Unsupported key type in ${fileName}: ${publicKey.asymmetricKeyType}. Only RSA and Ed25519 are supported.`,
			)
			continue
		}

		const entry: PublicKeyEntry = {
			name: fileName.replace(".pub", ""),
			publicKey,
			fingerprint: getKeyFingerprint(publicKey),
			algorithm,
		}

		if (algorithm === "ed25519") {
			entry.rawPublicKey = extractEd25519RawPublicKey(publicKey)
		}

		publicKeys.push(entry)
	}

	return publicKeys
}

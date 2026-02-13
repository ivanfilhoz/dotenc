import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getKeyFingerprint } from "./getKeyFingerprint"
import { parseOpenSSHPrivateKey } from "./parseOpenSSHKey"

export type PrivateKeyEntry = {
	name: string
	privateKey: crypto.KeyObject
	fingerprint: string
	algorithm: "rsa" | "ed25519"
	rawSeed?: Buffer
	rawPublicKey?: Buffer
}

const SSH_KEY_FILES = [
	"id_ed25519",
	"id_rsa",
	"id_ecdsa",
	"id_dsa",
]

function extractEd25519RawKeys(privateKey: crypto.KeyObject): {
	rawSeed: Buffer
	rawPublicKey: Buffer
} {
	const privDer = privateKey.export({ type: "pkcs8", format: "der" })
	const rawSeed = Buffer.from(privDer.subarray(privDer.length - 32))

	const publicKey = crypto.createPublicKey(privateKey)
	const pubDer = publicKey.export({ type: "spki", format: "der" })
	const rawPublicKey = Buffer.from(pubDer.subarray(pubDer.length - 32))

	return { rawSeed, rawPublicKey }
}

function detectAlgorithm(
	privateKey: crypto.KeyObject,
): "rsa" | "ed25519" | null {
	const keyType = privateKey.asymmetricKeyType
	if (keyType === "rsa") return "rsa"
	if (keyType === "ed25519") return "ed25519"
	return null
}

function tryParsePrivateKey(
	keyContent: string,
): crypto.KeyObject | null {
	try {
		return crypto.createPrivateKey(keyContent)
	} catch {
		// Fallback: parse OpenSSH format that Node/OpenSSL can't handle natively
		return parseOpenSSHPrivateKey(keyContent)
	}
}

export const getPrivateKeys = async () => {
	const privateKeys: PrivateKeyEntry[] = []

	// Check DOTENC_PRIVATE_KEY env var first
	if (process.env.DOTENC_PRIVATE_KEY) {
		let privateKey: crypto.KeyObject | null = null
		try {
			privateKey = crypto.createPrivateKey(
				process.env.DOTENC_PRIVATE_KEY,
			)
		} catch {
			// Fallback: parse OpenSSH format that Node/OpenSSL can't handle natively
			privateKey = parseOpenSSHPrivateKey(process.env.DOTENC_PRIVATE_KEY)
		}

		if (privateKey) {
			const algorithm = detectAlgorithm(privateKey)

			if (algorithm) {
				const entry: PrivateKeyEntry = {
					name: "env.DOTENC_PRIVATE_KEY",
					privateKey,
					fingerprint: getKeyFingerprint(privateKey),
					algorithm,
				}

				if (algorithm === "ed25519") {
					const { rawSeed, rawPublicKey } =
						extractEd25519RawKeys(privateKey)
					entry.rawSeed = rawSeed
					entry.rawPublicKey = rawPublicKey
				}

				privateKeys.push(entry)
			} else {
				console.error(
					`Unsupported key type in DOTENC_PRIVATE_KEY: ${privateKey.asymmetricKeyType}. Only RSA and Ed25519 are supported.`,
				)
			}
		} else {
			console.error(
				"Invalid private key format in DOTENC_PRIVATE_KEY environment variable. Please provide a valid private key (PEM or OpenSSH format).",
			)
		}
	}

	// Scan ~/.ssh/ for SSH key files
	const sshDir = path.join(os.homedir(), ".ssh")
	if (!existsSync(sshDir)) {
		return privateKeys
	}

	const files = await fs.readdir(sshDir)

	// First check well-known key names, then any other files that look like private keys
	const knownFiles = SSH_KEY_FILES.filter((f) => files.includes(f))
	const otherFiles = files.filter(
		(f) =>
			!SSH_KEY_FILES.includes(f) &&
			!f.endsWith(".pub") &&
			!f.startsWith("known_hosts") &&
			!f.startsWith("authorized_keys") &&
			f !== "config",
	)

	for (const fileName of [...knownFiles, ...otherFiles]) {
		const filePath = path.join(sshDir, fileName)

		let stat: Awaited<ReturnType<typeof fs.stat>>
		try {
			stat = await fs.stat(filePath)
		} catch {
			continue
		}

		if (!stat.isFile()) continue

		let keyContent: string
		try {
			keyContent = await fs.readFile(filePath, "utf-8")
		} catch {
			continue
		}

		// Quick check: must look like a private key file
		if (!keyContent.includes("PRIVATE KEY")) continue

		const privateKey = tryParsePrivateKey(keyContent)

		if (!privateKey) {
			// Could be passphrase-protected — skip silently in auto-scan
			continue
		}

		const algorithm = detectAlgorithm(privateKey)
		if (!algorithm) continue

		const entry: PrivateKeyEntry = {
			name: fileName,
			privateKey,
			fingerprint: getKeyFingerprint(privateKey),
			algorithm,
		}

		if (algorithm === "ed25519") {
			const { rawSeed, rawPublicKey } =
				extractEd25519RawKeys(privateKey)
			entry.rawSeed = rawSeed
			entry.rawPublicKey = rawPublicKey
		}

		privateKeys.push(entry)
	}

	return privateKeys
}

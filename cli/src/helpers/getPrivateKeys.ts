import crypto from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { getKeyFingerprint } from "./getKeyFingerprint"
import { isPassphraseProtected } from "./isPassphraseProtected"
import { parseOpenSSHPrivateKey } from "./parseOpenSSHKey"

export type PrivateKeyEntry = {
	name: string
	privateKey: crypto.KeyObject
	fingerprint: string
	algorithm: "rsa" | "ed25519"
	rawPublicKey?: Buffer
}

export type UnsupportedPrivateKeyEntry = {
	name: string
	reason: string
}

const SSH_KEY_FILES = ["id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"]

function extractEd25519RawKeys(privateKey: crypto.KeyObject): {
	rawPublicKey: Buffer
} {
	const publicKey = crypto.createPublicKey(privateKey)
	const pubDer = publicKey.export({ type: "spki", format: "der" })
	const rawPublicKey = Buffer.from(pubDer.subarray(pubDer.length - 32))

	return { rawPublicKey }
}

function detectAlgorithm(
	privateKey: crypto.KeyObject,
): "rsa" | "ed25519" | null {
	const keyType = privateKey.asymmetricKeyType
	if (keyType === "rsa") return "rsa"
	if (keyType === "ed25519") return "ed25519"
	return null
}

function tryParsePrivateKey(keyContent: string): crypto.KeyObject | null {
	try {
		return crypto.createPrivateKey(keyContent)
	} catch {
		// Fallback: parse OpenSSH format that Node/OpenSSL can't handle natively
		return parseOpenSSHPrivateKey(keyContent)
	}
}

function describeUnsupportedAlgorithm(
	keyType: crypto.KeyObject["asymmetricKeyType"] | string | undefined,
) {
	return `unsupported algorithm: ${String(keyType ?? "unknown")}`
}

function readLengthPrefixedBytes(
	buffer: Buffer,
	offset: number,
): { bytes: Buffer; nextOffset: number } | null {
	if (offset + 4 > buffer.length) return null
	const length = buffer.readUInt32BE(offset)
	const start = offset + 4
	const end = start + length
	if (end > buffer.length) return null
	return { bytes: buffer.subarray(start, end), nextOffset: end }
}

function readLengthPrefixedString(
	buffer: Buffer,
	offset: number,
): { value: string; nextOffset: number } | null {
	const bytes = readLengthPrefixedBytes(buffer, offset)
	if (!bytes) return null
	return { value: bytes.bytes.toString("ascii"), nextOffset: bytes.nextOffset }
}

function detectUnsupportedOpenSSHAlgorithm(keyContent: string): string | null {
	if (!keyContent.includes("BEGIN OPENSSH PRIVATE KEY")) return null

	const lines = keyContent.split("\n")
	const startIdx = lines.findIndex((line) =>
		line.trim().startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
	)
	const endIdx = lines.findIndex((line) =>
		line.trim().startsWith("-----END OPENSSH PRIVATE KEY-----"),
	)
	if (startIdx === -1 || endIdx === -1) return null

	const base64 = lines
		.slice(startIdx + 1, endIdx)
		.map((line) => line.trim())
		.join("")
	const buffer = Buffer.from(base64, "base64")

	const MAGIC = "openssh-key-v1\0"
	if (buffer.length < MAGIC.length) return null
	const magic = buffer.subarray(0, MAGIC.length).toString("ascii")
	if (magic !== MAGIC) return null

	let offset = MAGIC.length

	const ciphername = readLengthPrefixedString(buffer, offset)
	if (!ciphername) return null
	offset = ciphername.nextOffset

	const kdfname = readLengthPrefixedString(buffer, offset)
	if (!kdfname) return null
	offset = kdfname.nextOffset

	const kdfoptions = readLengthPrefixedBytes(buffer, offset)
	if (!kdfoptions) return null
	offset = kdfoptions.nextOffset

	if (offset + 4 > buffer.length) return null
	const keyCount = buffer.readUInt32BE(offset)
	offset += 4
	if (keyCount < 1) return null

	const publicBlob = readLengthPrefixedBytes(buffer, offset)
	if (!publicBlob) return null

	const publicBlobType = readLengthPrefixedString(publicBlob.bytes, 0)
	if (!publicBlobType) return null

	if (publicBlobType.value === "ssh-rsa") return null
	if (publicBlobType.value === "ssh-ed25519") return null

	return publicBlobType.value
}

export type GetPrivateKeysResult = {
	keys: PrivateKeyEntry[]
	passphraseProtectedKeys: string[]
	unsupportedKeys?: UnsupportedPrivateKeyEntry[]
}

export const getPrivateKeys = async (): Promise<GetPrivateKeysResult> => {
	const privateKeys: PrivateKeyEntry[] = []
	const passphraseProtectedKeys: string[] = []
	const unsupportedKeys: UnsupportedPrivateKeyEntry[] = []

	// Check DOTENC_PRIVATE_KEY env var first
	if (process.env.DOTENC_PRIVATE_KEY) {
		let privateKey: crypto.KeyObject | null = null
		try {
			privateKey = crypto.createPrivateKey(process.env.DOTENC_PRIVATE_KEY)
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
					const { rawPublicKey } = extractEd25519RawKeys(privateKey)
					entry.rawPublicKey = rawPublicKey
				}

				privateKeys.push(entry)
			} else {
				unsupportedKeys.push({
					name: "env.DOTENC_PRIVATE_KEY",
					reason: describeUnsupportedAlgorithm(privateKey.asymmetricKeyType),
				})
				console.error(
					`Unsupported key type in DOTENC_PRIVATE_KEY: ${privateKey.asymmetricKeyType}. Only RSA and Ed25519 are supported.`,
				)
			}
		} else {
			if (isPassphraseProtected(process.env.DOTENC_PRIVATE_KEY)) {
				console.error(
					"Error: the key in DOTENC_PRIVATE_KEY is passphrase-protected, which is not currently supported by dotenc.",
				)
				process.exit(1)
			}
			console.error(
				"Invalid private key format in DOTENC_PRIVATE_KEY environment variable. Please provide a valid private key (PEM or OpenSSH format).",
			)
			unsupportedKeys.push({
				name: "env.DOTENC_PRIVATE_KEY",
				reason: "invalid private key format",
			})
		}
	}

	// Scan ~/.ssh/ for SSH key files
	const sshDir = path.join(os.homedir(), ".ssh")
	if (!existsSync(sshDir)) {
		return { keys: privateKeys, passphraseProtectedKeys, unsupportedKeys }
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
			if (isPassphraseProtected(keyContent)) {
				passphraseProtectedKeys.push(fileName)
				unsupportedKeys.push({
					name: fileName,
					reason: "passphrase-protected",
				})
			} else {
				const unsupportedOpenSSHType =
					detectUnsupportedOpenSSHAlgorithm(keyContent)
				unsupportedKeys.push({
					name: fileName,
					reason: unsupportedOpenSSHType
						? describeUnsupportedAlgorithm(unsupportedOpenSSHType)
						: "invalid private key format",
				})
			}
			continue
		}

		const algorithm = detectAlgorithm(privateKey)
		if (!algorithm) {
			unsupportedKeys.push({
				name: fileName,
				reason: describeUnsupportedAlgorithm(privateKey.asymmetricKeyType),
			})
			continue
		}

		const entry: PrivateKeyEntry = {
			name: fileName,
			privateKey,
			fingerprint: getKeyFingerprint(privateKey),
			algorithm,
		}

		if (algorithm === "ed25519") {
			const { rawPublicKey } = extractEd25519RawKeys(privateKey)
			entry.rawPublicKey = rawPublicKey
		}

		privateKeys.push(entry)
	}

	return { keys: privateKeys, passphraseProtectedKeys, unsupportedKeys }
}

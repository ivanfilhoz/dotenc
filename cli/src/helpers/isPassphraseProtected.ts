/**
 * Detects whether a private key string is passphrase-protected.
 *
 * Supports:
 * - OpenSSH format: parses the binary header to check if ciphername !== "none"
 * - PEM encrypted format: checks for "ENCRYPTED" in header or Proc-Type line
 */
export function isPassphraseProtected(keyContent: string): boolean {
	// PEM encrypted private key (PKCS#8 encrypted or legacy encrypted)
	if (keyContent.includes("BEGIN ENCRYPTED PRIVATE KEY")) {
		return true
	}

	// Legacy PEM encryption header
	if (keyContent.includes("Proc-Type: 4,ENCRYPTED")) {
		return true
	}

	// OpenSSH format: parse binary to check ciphername
	if (keyContent.includes("BEGIN OPENSSH PRIVATE KEY")) {
		return isOpenSSHKeyEncrypted(keyContent)
	}

	return false
}

function isOpenSSHKeyEncrypted(content: string): boolean {
	const lines = content.split("\n")
	const startIdx = lines.findIndex((l) =>
		l.trim().startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
	)
	const endIdx = lines.findIndex((l) =>
		l.trim().startsWith("-----END OPENSSH PRIVATE KEY-----"),
	)

	if (startIdx === -1 || endIdx === -1) return false

	const base64 = lines
		.slice(startIdx + 1, endIdx)
		.map((l) => l.trim())
		.join("")

	let buf: Buffer
	try {
		buf = Buffer.from(base64, "base64")
	} catch {
		return false
	}

	let offset = 0

	// Check magic: "openssh-key-v1\0"
	const MAGIC = "openssh-key-v1\0"
	if (buf.length < MAGIC.length) return false
	const magic = buf.subarray(0, MAGIC.length).toString("ascii")
	if (magic !== MAGIC) return false
	offset += MAGIC.length

	// Read ciphername (length-prefixed string)
	if (offset + 4 > buf.length) return false
	const cipherLen = buf.readUInt32BE(offset)
	offset += 4
	if (offset + cipherLen > buf.length) return false
	const ciphername = buf.subarray(offset, offset + cipherLen).toString("ascii")

	return ciphername !== "none"
}

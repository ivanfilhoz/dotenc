import crypto from "node:crypto"

/**
 * Parses an unencrypted OpenSSH private key (the format produced by modern ssh-keygen).
 * Node's crypto.createPrivateKey() cannot handle these natively (it only handles PEM/DER).
 *
 * Supports: Ed25519, RSA
 * Returns null for passphrase-protected or unsupported key types.
 */
export function parseOpenSSHPrivateKey(
	content: string,
): crypto.KeyObject | null {
	// Strip the PEM header/footer and decode base64
	const lines = content.split("\n")
	const startIdx = lines.findIndex((l) =>
		l.trim().startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
	)
	const endIdx = lines.findIndex((l) =>
		l.trim().startsWith("-----END OPENSSH PRIVATE KEY-----"),
	)

	if (startIdx === -1 || endIdx === -1) return null

	const base64 = lines
		.slice(startIdx + 1, endIdx)
		.map((l) => l.trim())
		.join("")
	const buf = Buffer.from(base64, "base64")

	let offset = 0

	// Check magic: "openssh-key-v1\0"
	const MAGIC = "openssh-key-v1\0"
	const magic = buf.subarray(0, MAGIC.length).toString("ascii")
	if (magic !== MAGIC) return null
	offset += MAGIC.length

	// Read ciphername
	const ciphername = readString(buf, offset)
	if (!ciphername) return null
	offset = ciphername.nextOffset

	// If encrypted, we can't parse it
	if (ciphername.value !== "none") return null

	// Read kdfname
	const kdfname = readString(buf, offset)
	if (!kdfname) return null
	offset = kdfname.nextOffset

	// Read kdfoptions
	const kdfoptions = readString(buf, offset)
	if (!kdfoptions) return null
	offset = kdfoptions.nextOffset

	// Read number of keys
	if (offset + 4 > buf.length) return null
	const numKeys = buf.readUInt32BE(offset)
	offset += 4
	if (numKeys !== 1) return null

	// Skip public key(s) section
	const pubKeyBlob = readString(buf, offset)
	if (!pubKeyBlob) return null
	offset = pubKeyBlob.nextOffset

	// Read private key blob
	const privBlob = readBytes(buf, offset)
	if (!privBlob) return null

	const priv = privBlob.value
	let pOffset = 0

	// Read check integers (must match)
	if (pOffset + 8 > priv.length) return null
	const check1 = priv.readUInt32BE(pOffset)
	pOffset += 4
	const check2 = priv.readUInt32BE(pOffset)
	pOffset += 4
	if (check1 !== check2) return null

	// Read key type
	const keyType = readString(priv, pOffset)
	if (!keyType) return null
	pOffset = keyType.nextOffset

	if (keyType.value === "ssh-ed25519") {
		return parseEd25519(priv, pOffset)
	}

	if (keyType.value === "ssh-rsa") {
		return parseRSA(priv, pOffset)
	}

	return null
}

function parseEd25519(
	priv: Buffer,
	offset: number,
): crypto.KeyObject | null {
	// Read 32-byte public key
	const pubKey = readBytes(priv, offset)
	if (!pubKey || pubKey.value.length !== 32) return null
	offset = pubKey.nextOffset

	// Read 64-byte private key (32 seed + 32 public)
	const privKey = readBytes(priv, offset)
	if (!privKey || privKey.value.length !== 64) return null

	const seed = privKey.value.subarray(0, 32)

	// Build PKCS#8 DER for Ed25519
	// Fixed prefix for Ed25519 PKCS#8: 16 bytes
	const pkcs8Prefix = Buffer.from([
		0x30, 0x2e, // SEQUENCE (46 bytes)
		0x02, 0x01, 0x00, // INTEGER 0 (version)
		0x30, 0x05, // SEQUENCE (5 bytes)
		0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
		0x04, 0x22, // OCTET STRING (34 bytes)
		0x04, 0x20, // OCTET STRING (32 bytes) - the seed
	])

	const der = Buffer.concat([pkcs8Prefix, seed])

	try {
		return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" })
	} catch {
		return null
	}
}

function parseRSA(
	priv: Buffer,
	offset: number,
): crypto.KeyObject | null {
	// RSA private key fields in OpenSSH format:
	// mpint n, mpint e, mpint d, mpint iqmp, mpint p, mpint q
	const n = readMpint(priv, offset)
	if (!n) return null
	offset = n.nextOffset

	const e = readMpint(priv, offset)
	if (!e) return null
	offset = e.nextOffset

	const d = readMpint(priv, offset)
	if (!d) return null
	offset = d.nextOffset

	const iqmp = readMpint(priv, offset)
	if (!iqmp) return null
	offset = iqmp.nextOffset

	const p = readMpint(priv, offset)
	if (!p) return null
	offset = p.nextOffset

	const q = readMpint(priv, offset)
	if (!q) return null

	// Compute dp and dq using BigInt
	const dBig = bufToBigInt(d.value)
	const pBig = bufToBigInt(p.value)
	const qBig = bufToBigInt(q.value)
	const dp = dBig % (pBig - 1n)
	const dq = dBig % (qBig - 1n)

	// Build JWK
	const jwk = {
		kty: "RSA" as const,
		n: bufToBase64Url(n.value),
		e: bufToBase64Url(e.value),
		d: bufToBase64Url(d.value),
		p: bufToBase64Url(p.value),
		q: bufToBase64Url(q.value),
		dp: bigIntToBase64Url(dp),
		dq: bigIntToBase64Url(dq),
		qi: bufToBase64Url(iqmp.value),
	}

	try {
		return crypto.createPrivateKey({ key: jwk, format: "jwk" })
	} catch {
		return null
	}
}

// --- Binary helpers ---

type ReadResult<T> = { value: T; nextOffset: number } | null

function readUint32(buf: Buffer, offset: number): ReadResult<number> {
	if (offset + 4 > buf.length) return null
	return { value: buf.readUInt32BE(offset), nextOffset: offset + 4 }
}

function readBytes(buf: Buffer, offset: number): ReadResult<Buffer> {
	const len = readUint32(buf, offset)
	if (!len) return null
	const end = len.nextOffset + len.value
	if (end > buf.length) return null
	return {
		value: buf.subarray(len.nextOffset, end),
		nextOffset: end,
	}
}

function readString(buf: Buffer, offset: number): ReadResult<string> {
	const bytes = readBytes(buf, offset)
	if (!bytes) return null
	return {
		value: bytes.value.toString("ascii"),
		nextOffset: bytes.nextOffset,
	}
}

function readMpint(buf: Buffer, offset: number): ReadResult<Buffer> {
	const bytes = readBytes(buf, offset)
	if (!bytes) return null
	// Strip leading zero byte used for sign padding
	let value = bytes.value
	if (value.length > 1 && value[0] === 0) {
		value = value.subarray(1)
	}
	return { value, nextOffset: bytes.nextOffset }
}

function bufToBase64Url(buf: Buffer): string {
	return Buffer.from(buf).toString("base64url")
}

function bufToBigInt(buf: Buffer): bigint {
	let result = 0n
	for (const byte of buf) {
		result = (result << 8n) | BigInt(byte)
	}
	return result
}

function bigIntToBase64Url(n: bigint): string {
	if (n === 0n) return "AA"
	const hex = n.toString(16)
	const padded = hex.length % 2 ? "0" + hex : hex
	return Buffer.from(padded, "hex").toString("base64url")
}

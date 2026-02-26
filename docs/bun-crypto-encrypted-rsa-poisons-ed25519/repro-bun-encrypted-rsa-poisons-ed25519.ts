import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

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

function parseOpenSshEd25519PrivateKey(content: string): crypto.KeyObject {
	const lines = content.split("\n")
	const startIdx = lines.findIndex((line) =>
		line.trim().startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
	)
	const endIdx = lines.findIndex((line) =>
		line.trim().startsWith("-----END OPENSSH PRIVATE KEY-----"),
	)

	assert.notEqual(startIdx, -1, "Missing OpenSSH private key header")
	assert.notEqual(endIdx, -1, "Missing OpenSSH private key footer")
	assert.ok(endIdx > startIdx, "Invalid OpenSSH key block")

	const base64 = lines
		.slice(startIdx + 1, endIdx)
		.map((line) => line.trim())
		.join("")
	const buf = Buffer.from(base64, "base64")

	const MAGIC = "openssh-key-v1\0"
	let offset = 0
	assert.equal(
		buf.subarray(0, MAGIC.length).toString("ascii"),
		MAGIC,
		"Invalid OpenSSH magic",
	)
	offset += MAGIC.length

	const ciphername = readString(buf, offset)
	assert.ok(ciphername, "Missing ciphername")
	offset = ciphername.nextOffset
	assert.equal(ciphername.value, "none", "Expected unencrypted OpenSSH key")

	const kdfname = readString(buf, offset)
	assert.ok(kdfname, "Missing kdfname")
	offset = kdfname.nextOffset

	const kdfoptions = readBytes(buf, offset)
	assert.ok(kdfoptions, "Missing kdfoptions")
	offset = kdfoptions.nextOffset

	const numKeys = readUint32(buf, offset)
	assert.ok(numKeys, "Missing key count")
	offset = numKeys.nextOffset
	assert.equal(numKeys.value, 1, "Expected exactly one key")

	const publicBlob = readBytes(buf, offset)
	assert.ok(publicBlob, "Missing public key blob")
	offset = publicBlob.nextOffset

	const privateBlob = readBytes(buf, offset)
	assert.ok(privateBlob, "Missing private key blob")

	const priv = privateBlob.value
	let pOffset = 0

	const check1 = readUint32(priv, pOffset)
	assert.ok(check1, "Missing checkint1")
	pOffset = check1.nextOffset

	const check2 = readUint32(priv, pOffset)
	assert.ok(check2, "Missing checkint2")
	pOffset = check2.nextOffset
	assert.equal(check1.value, check2.value, "OpenSSH checkints do not match")

	const keyType = readString(priv, pOffset)
	assert.ok(keyType, "Missing key type")
	pOffset = keyType.nextOffset
	assert.equal(keyType.value, "ssh-ed25519", "Expected ssh-ed25519")

	const publicKey = readBytes(priv, pOffset)
	assert.ok(publicKey, "Missing ed25519 public key")
	pOffset = publicKey.nextOffset
	assert.equal(publicKey.value.length, 32, "Expected 32-byte ed25519 public key")

	const privateKey = readBytes(priv, pOffset)
	assert.ok(privateKey, "Missing ed25519 private key")
	assert.equal(
		privateKey.value.length,
		64,
		"Expected 64-byte ed25519 private key payload (seed + public)",
	)

	const seed = privateKey.value.subarray(0, 32)

	const pkcs8Prefix = Buffer.from([
		0x30,
		0x2e,
		0x02,
		0x01,
		0x00,
		0x30,
		0x05,
		0x06,
		0x03,
		0x2b,
		0x65,
		0x70,
		0x04,
		0x22,
		0x04,
		0x20,
	])
	const der = Buffer.concat([pkcs8Prefix, seed])

	return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" })
}

function printResult(
	label: string,
	result:
		| { ok: true; type: crypto.KeyObject["asymmetricKeyType"] | undefined }
		| { ok: false; error: string },
) {
	console.log(`${label}:`, result)
}

function tryParseOpenSshEd25519(content: string) {
	try {
		const key = parseOpenSshEd25519PrivateKey(content)
		return {
			ok: true as const,
			type: key.asymmetricKeyType,
		}
	} catch (error) {
		return {
			ok: false as const,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "bun-key-poison-repro-"))

try {
	const ed25519Path = path.join(tmpDir, "id_ed25519")
	const encryptedRsaPath = path.join(tmpDir, "id_rsa_legacy_encrypted")

	execFileSync("ssh-keygen", [
		"-t",
		"ed25519",
		"-f",
		ed25519Path,
		"-N",
		"",
		"-q",
	])
	execFileSync("ssh-keygen", [
		"-t",
		"rsa",
		"-b",
		"2048",
		"-m",
		"PEM",
		"-f",
		encryptedRsaPath,
		"-N",
		"pass123",
		"-q",
	])

	const ed25519OpenSsh = readFileSync(ed25519Path, "utf-8")
	const encryptedLegacyRsaPem = readFileSync(encryptedRsaPath, "utf-8")

	const bunVersion = (globalThis as { Bun?: { version?: string } }).Bun?.version
	console.log("runtime:", bunVersion ? `bun ${bunVersion}` : "non-bun")
	console.log(
		"sequence:",
		"parse OpenSSH ed25519 -> crypto.createPrivateKey(encrypted legacy RSA PEM) throws -> parse OpenSSH ed25519 again",
	)

	const before = tryParseOpenSshEd25519(ed25519OpenSsh)
	printResult("parse before encrypted RSA error", before)
	assert.equal(before.ok, true, "Baseline OpenSSH ed25519 parse must succeed")
	assert.equal(before.type, "ed25519", "Baseline parsed key must be ed25519")

	try {
		crypto.createPrivateKey(encryptedLegacyRsaPem)
		throw new Error("Expected encrypted RSA PEM import to throw")
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.log("encrypted RSA import error:", message)
	}

	const after = tryParseOpenSshEd25519(ed25519OpenSsh)
	printResult("parse after encrypted RSA error", after)

	if (!after.ok || after.type !== "ed25519") {
		console.error(
			"BUG REPRODUCED: Bun failed to parse the same OpenSSH ed25519 key after a thrown crypto.createPrivateKey(encrypted RSA PEM) call.",
		)
		process.exitCode = 1
	} else {
		console.log("No repro: second OpenSSH ed25519 parse succeeded.")
	}
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

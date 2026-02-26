/**
 * Repro: Bun crypto.createPrivateKey error paths that poison the OpenSSL error
 * queue, breaking subsequent PKCS#8 DER Ed25519 key imports in the same process.
 *
 * Each scenario is run in a fresh subprocess so queue state cannot bleed between
 * tests. Exit code 1 means at least one scenario reproduces the bug.
 *
 * Scenarios tested:
 *   A) encrypted-legacy-rsa-pem   — known positive (original repro)
 *   B) encrypted-pkcs8-pem        — BEGIN ENCRYPTED PRIVATE KEY format
 *   C) openssh-ed25519-pem        — unencrypted OpenSSH format; createPrivateKey throws (unrecognised format)
 *   D) garbage-pem                — fake PEM header with corrupt base64
 *
 * Usage:
 *   bun repro-bun-encrypted-rsa-poisons-ed25519.ts          # runs all scenarios
 *   bun repro-bun-encrypted-rsa-poisons-ed25519.ts --list   # lists scenarios
 */

import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import crypto from "node:crypto"
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"

const selfPath = process.argv[1]

// ---------------------------------------------------------------------------
// OpenSSH Ed25519 parser (same as dotenc's parseOpenSSHKey.ts)
// ---------------------------------------------------------------------------

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
	return { value: buf.subarray(len.nextOffset, end), nextOffset: end }
}

function readString(buf: Buffer, offset: number): ReadResult<string> {
	const bytes = readBytes(buf, offset)
	if (!bytes) return null
	return { value: bytes.value.toString("ascii"), nextOffset: bytes.nextOffset }
}

function parseOpenSshEd25519PrivateKey(content: string): crypto.KeyObject {
	const lines = content.split("\n")
	const startIdx = lines.findIndex((l) =>
		l.trim().startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
	)
	const endIdx = lines.findIndex((l) =>
		l.trim().startsWith("-----END OPENSSH PRIVATE KEY-----"),
	)

	assert.notEqual(startIdx, -1, "Missing OpenSSH private key header")
	assert.notEqual(endIdx, -1, "Missing OpenSSH private key footer")
	assert.ok(endIdx > startIdx, "Invalid OpenSSH key block")

	const base64 = lines
		.slice(startIdx + 1, endIdx)
		.map((l) => l.trim())
		.join("")
	const buf = Buffer.from(base64, "base64")

	const MAGIC = "openssh-key-v1\0"
	assert.equal(buf.subarray(0, MAGIC.length).toString("ascii"), MAGIC)
	let offset = MAGIC.length

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
	assert.equal(privateKey.value.length, 64, "Expected 64-byte ed25519 private key payload")

	const seed = privateKey.value.subarray(0, 32)
	const pkcs8Prefix = Buffer.from([
		0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05,
		0x06, 0x03, 0x2b, 0x65, 0x70,
		0x04, 0x22, 0x04, 0x20,
	])
	const der = Buffer.concat([pkcs8Prefix, seed])

	return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" })
}

function tryParseOpenSshEd25519(content: string) {
	try {
		const key = parseOpenSshEd25519PrivateKey(content)
		return { ok: true as const, type: key.asymmetricKeyType }
	} catch (error) {
		return {
			ok: false as const,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

// ---------------------------------------------------------------------------
// Subprocess mode — run a single scenario (detected via env var)
// ---------------------------------------------------------------------------

if (process.env.REPRO_SCENARIO) {
	const scenario = process.env.REPRO_SCENARIO
	const ed25519Path = process.env.REPRO_ED25519_PATH!
	const triggerPath = process.env.REPRO_TRIGGER_PATH!

	const ed25519Content = readFileSync(ed25519Path, "utf-8")
	const triggerContent = readFileSync(triggerPath, "utf-8")

	// Confirm baseline parse works
	const before = tryParseOpenSshEd25519(ed25519Content)
	if (!before.ok) {
		console.error(`[${scenario}] baseline parse failed: ${before.error}`)
		process.exit(2)
	}

	// Run the trigger — we expect this to throw; if it doesn't that's fine too
	let triggerError: string | null = null
	try {
		crypto.createPrivateKey(triggerContent)
	} catch (e) {
		triggerError = e instanceof Error ? e.message : String(e)
	}

	// Now try to parse the Ed25519 key again
	const after = tryParseOpenSshEd25519(ed25519Content)

	console.log(`trigger threw: ${triggerError ?? "no (key imported successfully)"}`)
	console.log(`after parse:  ${after.ok ? `ok (${after.type})` : `FAIL — ${after.error}`}`)

	process.exit(!after.ok || after.type !== "ed25519" ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Main — generate fixtures, run each scenario in a fresh subprocess
// ---------------------------------------------------------------------------

if (process.argv.includes("--list")) {
	console.log(
		"Scenarios: encrypted-legacy-rsa-pem, encrypted-pkcs8-pem, openssh-ed25519-pem, garbage-pem",
	)
	process.exit(0)
}

const bunVersion = (globalThis as { Bun?: { version?: string } }).Bun?.version
console.log("runtime:", bunVersion ? `bun ${bunVersion}` : "non-bun (node)")
console.log()

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "bun-key-poison-repro-"))

try {
	// Fixture: unencrypted OpenSSH Ed25519 key (used as the canary in every scenario)
	const ed25519Path = path.join(tmpDir, "id_ed25519")
	execFileSync("ssh-keygen", ["-t", "ed25519", "-f", ed25519Path, "-N", "", "-q"])

	// Fixture A: legacy encrypted RSA PEM (Proc-Type: 4,ENCRYPTED) — known positive
	const encryptedRsaPemPath = path.join(tmpDir, "id_rsa_legacy_enc")
	execFileSync("ssh-keygen", [
		"-t", "rsa", "-b", "2048", "-m", "PEM",
		"-f", encryptedRsaPemPath, "-N", "pass123", "-q",
	])

	// Fixture B: PKCS#8 encrypted PEM (BEGIN ENCRYPTED PRIVATE KEY)
	const encryptedPkcs8Path = path.join(tmpDir, "id_rsa_pkcs8_enc")
	execFileSync("openssl", [
		"genpkey", "-algorithm", "RSA",
		"-aes-256-cbc", "-pass", "pass:test123",
		"-out", encryptedPkcs8Path,
	])

	// Fixture C: unencrypted OpenSSH Ed25519 PEM fed to createPrivateKey
	// (createPrivateKey throws because it can't parse the OpenSSH wire format)
	// — same file as the canary

	// Fixture D: garbage PEM (fake header + corrupt base64 body)
	const garbagePemPath = path.join(tmpDir, "garbage.pem")
	writeFileSync(
		garbagePemPath,
		"-----BEGIN RSA PRIVATE KEY-----\nthisisnotvalidbase64!!!\n-----END RSA PRIVATE KEY-----\n",
	)

	const scenarios: Array<{ name: string; triggerPath: string }> = [
		{ name: "encrypted-legacy-rsa-pem", triggerPath: encryptedRsaPemPath },
		{ name: "encrypted-pkcs8-pem",      triggerPath: encryptedPkcs8Path },
		{ name: "openssh-ed25519-pem",       triggerPath: ed25519Path },
		{ name: "garbage-pem",               triggerPath: garbagePemPath },
	]

	const RESET = "\x1b[0m"
	const RED   = "\x1b[31m"
	const GREEN  = "\x1b[32m"

	let anyBug = false
	for (const { name, triggerPath } of scenarios) {
		const result = spawnSync(
			process.execPath,
			[selfPath],
			{
				encoding: "utf-8",
				stdio: "pipe",
				env: {
					...process.env,
					REPRO_SCENARIO: name,
					REPRO_ED25519_PATH: ed25519Path,
					REPRO_TRIGGER_PATH: triggerPath,
				},
			},
		)

		const poisoned = result.status === 1
		const errored  = result.status === 2 || result.status === null

		const label = errored
			? `${RED}ERROR${RESET}`
			: poisoned
				? `${RED}POISONS queue${RESET}`
				: `${GREEN}safe${RESET}`

		console.log(`${name.padEnd(28)} ${label}`)
		if (result.stdout) {
			for (const line of result.stdout.trimEnd().split("\n")) {
				console.log(`  ${line}`)
			}
		}
		if (result.stderr) process.stderr.write(result.stderr)
		console.log()

		if (poisoned || errored) anyBug = true
	}

	if (anyBug) {
		console.error("At least one scenario reproduces the Bun OpenSSL queue poisoning bug.")
		process.exitCode = 1
	} else {
		console.log("All scenarios safe — no queue poisoning detected.")
	}
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

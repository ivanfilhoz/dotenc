import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { execSync } from "node:child_process"
import crypto from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseOpenSSHPrivateKey } from "../helpers/parseOpenSSHKey"

describe("parseOpenSSHPrivateKey", () => {
	let tmpDir: string
	let ed25519Content: string
	let rsaContent: string

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-openssh-"))

		// Generate Ed25519 key in OpenSSH format
		execSync(
			`ssh-keygen -t ed25519 -f ${path.join(tmpDir, "id_ed25519")} -N "" -q`,
		)
		ed25519Content = readFileSync(path.join(tmpDir, "id_ed25519"), "utf-8")

		// Generate RSA key in OpenSSH format
		execSync(
			`ssh-keygen -t rsa -b 2048 -f ${path.join(tmpDir, "id_rsa")} -N "" -q`,
		)
		rsaContent = readFileSync(path.join(tmpDir, "id_rsa"), "utf-8")
	})

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("parses an Ed25519 OpenSSH private key", () => {
		const key = parseOpenSSHPrivateKey(ed25519Content)
		expect(key).not.toBeNull()
		expect(key?.type).toBe("private")
		expect(key?.asymmetricKeyType).toBe("ed25519")
	})

	test("parses an RSA OpenSSH private key", () => {
		const key = parseOpenSSHPrivateKey(rsaContent)
		expect(key).not.toBeNull()
		expect(key?.type).toBe("private")
		expect(key?.asymmetricKeyType).toBe("rsa")
	})

	test("parsed Ed25519 key can sign and verify", () => {
		const privateKey = parseOpenSSHPrivateKey(ed25519Content)
		if (!privateKey) throw new Error("Expected a valid key")
		const publicKey = crypto.createPublicKey(privateKey)
		const data = Buffer.from("hello")
		const sig = crypto.sign(null, data, privateKey)
		expect(crypto.verify(null, data, publicKey, sig)).toBe(true)
	})

	test("parsed RSA key can sign and verify", () => {
		const privateKey = parseOpenSSHPrivateKey(rsaContent)
		if (!privateKey) throw new Error("Expected a valid key")
		const publicKey = crypto.createPublicKey(privateKey)
		const data = Buffer.from("hello")
		const sig = crypto.sign("sha256", data, privateKey)
		expect(crypto.verify("sha256", data, publicKey, sig)).toBe(true)
	})

	test("returns null for invalid content", () => {
		expect(parseOpenSSHPrivateKey("not a key")).toBeNull()
	})

	test("returns null for truncated key", () => {
		const truncated = ed25519Content.split("\n").slice(0, 2).join("\n")
		expect(parseOpenSSHPrivateKey(truncated)).toBeNull()
	})

	test("returns null for corrupted base64", () => {
		const lines = ed25519Content.split("\n")
		lines[1] = "AAAA!!!!corrupted"
		expect(parseOpenSSHPrivateKey(lines.join("\n"))).toBeNull()
	})
})

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { execSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { isPassphraseProtected } from "../helpers/isPassphraseProtected"

describe("isPassphraseProtected", () => {
	let tmpDir: string
	let openSshUnencryptedKey: string
	let openSshEncryptedKey: string

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-passphrase-"))

		const plainPath = path.join(tmpDir, "id_ed25519_plain")
		const encryptedPath = path.join(tmpDir, "id_ed25519_encrypted")

		execSync(`ssh-keygen -t ed25519 -f "${plainPath}" -N "" -q`)
		execSync(`ssh-keygen -t ed25519 -f "${encryptedPath}" -N "secret" -q`)

		openSshUnencryptedKey = readFileSync(plainPath, "utf-8")
		openSshEncryptedKey = readFileSync(encryptedPath, "utf-8")
	})

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("detects PKCS#8 encrypted PEM keys", () => {
		const key = [
			"-----BEGIN ENCRYPTED PRIVATE KEY-----",
			"ZmFrZQ==",
			"-----END ENCRYPTED PRIVATE KEY-----",
		].join("\n")

		expect(isPassphraseProtected(key)).toBe(true)
	})

	test("detects legacy PEM Proc-Type encryption headers", () => {
		const key = [
			"-----BEGIN RSA PRIVATE KEY-----",
			"Proc-Type: 4,ENCRYPTED",
			"DEK-Info: AES-256-CBC,0123456789ABCDEF",
			"",
			"ZmFrZQ==",
			"-----END RSA PRIVATE KEY-----",
		].join("\n")

		expect(isPassphraseProtected(key)).toBe(true)
	})

	test("returns false for regular unencrypted PEM markers", () => {
		const key = [
			"-----BEGIN PRIVATE KEY-----",
			"ZmFrZQ==",
			"-----END PRIVATE KEY-----",
		].join("\n")

		expect(isPassphraseProtected(key)).toBe(false)
	})

	test("detects encrypted OpenSSH private keys", () => {
		expect(isPassphraseProtected(openSshEncryptedKey)).toBe(true)
	})

	test("does not flag unencrypted OpenSSH private keys", () => {
		expect(isPassphraseProtected(openSshUnencryptedKey)).toBe(false)
	})

	test("returns false for malformed OpenSSH blocks", () => {
		const malformed = [
			"-----BEGIN OPENSSH PRIVATE KEY-----",
			"AAAA-not-valid-base64",
			"-----END OPENSSH PRIVATE KEY-----",
		].join("\n")

		expect(isPassphraseProtected(malformed)).toBe(false)
	})
})

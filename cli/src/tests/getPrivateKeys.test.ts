import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { execSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getPrivateKeys } from "../helpers/getPrivateKeys"

describe("getPrivateKeys", () => {
	let tmpDir: string
	let ed25519PrivateKeyPem: string
	let rsaPrivateKeyPem: string
	const originalDotencKey = process.env.DOTENC_PRIVATE_KEY

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-privkeys-"))
		mkdirSync(path.join(tmpDir, ".ssh"), { recursive: true })

		execSync(
			`ssh-keygen -t ed25519 -f ${path.join(tmpDir, ".ssh", "id_ed25519")} -N "" -q`,
		)
		ed25519PrivateKeyPem = readFileSync(
			path.join(tmpDir, ".ssh", "id_ed25519"),
			"utf-8",
		)

		execSync(
			`ssh-keygen -t rsa -b 2048 -f ${path.join(tmpDir, ".ssh", "id_rsa")} -N "" -q`,
		)
		rsaPrivateKeyPem = readFileSync(
			path.join(tmpDir, ".ssh", "id_rsa"),
			"utf-8",
		)
	})

	afterAll(() => {
		if (originalDotencKey) process.env.DOTENC_PRIVATE_KEY = originalDotencKey
		else delete process.env.DOTENC_PRIVATE_KEY
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("parses Ed25519 key from DOTENC_PRIVATE_KEY", async () => {
		process.env.DOTENC_PRIVATE_KEY = ed25519PrivateKeyPem
		const { keys } = await getPrivateKeys()
		const envKey = keys.find((k) => k.name === "env.DOTENC_PRIVATE_KEY")
		expect(envKey).toBeDefined()
		expect(envKey?.algorithm).toBe("ed25519")
		expect(envKey?.fingerprint).toBeDefined()
		delete process.env.DOTENC_PRIVATE_KEY
	})

	test("parses RSA key from DOTENC_PRIVATE_KEY", async () => {
		process.env.DOTENC_PRIVATE_KEY = rsaPrivateKeyPem
		const { keys } = await getPrivateKeys()
		const envKey = keys.find((k) => k.name === "env.DOTENC_PRIVATE_KEY")
		expect(envKey).toBeDefined()
		expect(envKey?.algorithm).toBe("rsa")
		expect(envKey?.fingerprint).toBeDefined()
		delete process.env.DOTENC_PRIVATE_KEY
	})

	test("ignores invalid DOTENC_PRIVATE_KEY", async () => {
		const spy = spyOn(console, "error").mockImplementation(() => {})
		process.env.DOTENC_PRIVATE_KEY = "not a key"
		const { keys } = await getPrivateKeys()
		const envKey = keys.find((k) => k.name === "env.DOTENC_PRIVATE_KEY")
		expect(envKey).toBeUndefined()
		delete process.env.DOTENC_PRIVATE_KEY
		spy.mockRestore()
	})

	test("each key entry has required fields", async () => {
		process.env.DOTENC_PRIVATE_KEY = ed25519PrivateKeyPem
		const { keys } = await getPrivateKeys()
		for (const key of keys) {
			expect(typeof key.name).toBe("string")
			expect(key.privateKey).toBeDefined()
			expect(typeof key.fingerprint).toBe("string")
			expect(["rsa", "ed25519"]).toContain(key.algorithm)
		}
		delete process.env.DOTENC_PRIVATE_KEY
	})

	test("returns keys and passphraseProtectedKeys properties", async () => {
		delete process.env.DOTENC_PRIVATE_KEY
		const result = await getPrivateKeys()
		expect(result).toHaveProperty("keys")
		expect(result).toHaveProperty("passphraseProtectedKeys")
		expect(Array.isArray(result.keys)).toBe(true)
		expect(Array.isArray(result.passphraseProtectedKeys)).toBe(true)
	})
})

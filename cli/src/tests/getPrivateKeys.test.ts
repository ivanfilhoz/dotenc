import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import crypto from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getPrivateKeys } from "../helpers/getPrivateKeys"

describe("getPrivateKeys", () => {
	let tmpDir: string
	let ed25519PrivateKeyPem: string
	let rsaPrivateKeyPem: string
	const originalDotencKey = process.env.DOTENC_PRIVATE_KEY
	let homeSpy: ReturnType<typeof spyOn>

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-privkeys-"))
		mkdirSync(path.join(tmpDir, ".ssh"), { recursive: true })

		// Generate keys using crypto (portable, no ssh-keygen dependency)
		const ed = crypto.generateKeyPairSync("ed25519")
		ed25519PrivateKeyPem = ed.privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString()

		const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
		rsaPrivateKeyPem = rsa.privateKey
			.export({ type: "pkcs8", format: "pem" })
			.toString()

		// Write keys to SSH dir for the homedir scan
		writeFileSync(
			path.join(tmpDir, ".ssh", "id_ed25519"),
			ed25519PrivateKeyPem,
			"utf-8",
		)
		writeFileSync(
			path.join(tmpDir, ".ssh", "id_rsa"),
			rsaPrivateKeyPem,
			"utf-8",
		)

		// Mock homedir to isolate from runner's SSH keys
		homeSpy = spyOn(os, "homedir").mockReturnValue(tmpDir)
	})

	afterAll(() => {
		homeSpy.mockRestore()
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

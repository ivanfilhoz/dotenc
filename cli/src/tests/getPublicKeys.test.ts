import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import crypto from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getPublicKeys } from "../helpers/getPublicKeys"

describe("getPublicKeys", () => {
	let tmpDir: string

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-pubkeys-"))
		mkdirSync(path.join(tmpDir, ".dotenc"))

		// Write valid Ed25519 public key
		const ed = crypto.generateKeyPairSync("ed25519")
		writeFileSync(
			path.join(tmpDir, ".dotenc", "alice.pub"),
			ed.publicKey.export({ type: "spki", format: "pem" }).toString(),
			"utf-8",
		)

		// Write valid RSA public key
		const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
		writeFileSync(
			path.join(tmpDir, ".dotenc", "bob.pub"),
			rsa.publicKey.export({ type: "spki", format: "pem" }).toString(),
			"utf-8",
		)

		// Write a non-.pub file (should be ignored)
		writeFileSync(path.join(tmpDir, ".dotenc", "readme.txt"), "hi", "utf-8")
	})

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("finds all .pub keys in .dotenc/", async () => {
		const keys = await getPublicKeys(tmpDir)
		expect(keys).toHaveLength(2)
		const names = keys.map((k) => k.name)
		expect(names).toContain("alice")
		expect(names).toContain("bob")
	})

	test("detects correct algorithms", async () => {
		const keys = await getPublicKeys(tmpDir)
		const alice = keys.find((k) => k.name === "alice")
		const bob = keys.find((k) => k.name === "bob")
		expect(alice?.algorithm).toBe("ed25519")
		expect(bob?.algorithm).toBe("rsa")
	})

	test("each key has required fields", async () => {
		const keys = await getPublicKeys(tmpDir)
		for (const key of keys) {
			expect(key.name).toBeDefined()
			expect(key.publicKey).toBeDefined()
			expect(key.fingerprint).toBeDefined()
			expect(["rsa", "ed25519"]).toContain(key.algorithm)
		}
	})

	test("returns empty array when .dotenc/ does not exist", async () => {
		const emptyDir = mkdtempSync(path.join(os.tmpdir(), "test-pubkeys-empty-"))
		const keys = await getPublicKeys(emptyDir)
		expect(keys).toHaveLength(0)
		rmSync(emptyDir, { recursive: true, force: true })
	})
})

import crypto from "node:crypto"
import { describe, expect, test } from "vitest"
import { decryptData, encryptData } from "../helpers/crypto"

const key = crypto.randomBytes(32)
const wrongKey = crypto.randomBytes(32)
const message = "Hello, dotenc!"

describe("crypto helpers", () => {
	test("encrypt and decrypt returns original message", async () => {
		const encrypted = await encryptData(key, message)
		const decrypted = await decryptData(key, encrypted)
		expect(decrypted).toBe(message)
	})

	test("decrypt with wrong key throws error", async () => {
		const encrypted = await encryptData(key, message)
		await expect(decryptData(wrongKey, encrypted)).rejects.toThrow(
			/Failed to decrypt file/,
		)
	})

	test("key must be 32 bytes", async () => {
		const shortKey = crypto.randomBytes(16)
		await expect(encryptData(shortKey, message)).rejects.toThrow(
			/Key must be 32 bytes/,
		)
		const encrypted = await encryptData(key, message)
		await expect(decryptData(shortKey, encrypted)).rejects.toThrow(
			/Key must be 32 bytes/,
		)
	})
})

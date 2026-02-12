import crypto from "node:crypto"
import { describe, expect, test } from "vitest"
import { decryptData, encryptData } from "../helpers/crypto"
import { decryptDataKey } from "../helpers/decryptDataKey"
import { encryptDataKey } from "../helpers/encryptDataKey"

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

describe("RSA data key encryption", () => {
	const rsaKeyPair = crypto.generateKeyPairSync("rsa", {
		modulusLength: 2048,
	})

	test("encrypt and decrypt data key round-trip", () => {
		const dataKey = crypto.randomBytes(32)
		const encrypted = encryptDataKey(
			{
				algorithm: "rsa",
				publicKey: rsaKeyPair.publicKey,
			},
			dataKey,
		)
		const decrypted = decryptDataKey(
			{
				algorithm: "rsa",
				privateKey: rsaKeyPair.privateKey,
			},
			encrypted,
		)
		expect(Buffer.compare(decrypted, dataKey)).toBe(0)
	})
})

describe("Ed25519 data key encryption", () => {
	const ed25519KeyPair = crypto.generateKeyPairSync("ed25519")
	const privDer = ed25519KeyPair.privateKey.export({
		type: "pkcs8",
		format: "der",
	})
	const rawSeed = Buffer.from(privDer.subarray(privDer.length - 32))
	const pubDer = ed25519KeyPair.publicKey.export({
		type: "spki",
		format: "der",
	})
	const rawPublicKey = Buffer.from(pubDer.subarray(pubDer.length - 32))

	test("encrypt and decrypt data key round-trip", () => {
		const dataKey = crypto.randomBytes(32)
		const encrypted = encryptDataKey(
			{
				algorithm: "ed25519",
				publicKey: ed25519KeyPair.publicKey,
				rawPublicKey,
			},
			dataKey,
		)
		const decrypted = decryptDataKey(
			{
				algorithm: "ed25519",
				privateKey: ed25519KeyPair.privateKey,
				rawSeed,
			},
			encrypted,
		)
		expect(Buffer.compare(decrypted, dataKey)).toBe(0)
	})

	test("throws without raw public key for ed25519 encryption", () => {
		const dataKey = crypto.randomBytes(32)
		expect(() =>
			encryptDataKey(
				{
					algorithm: "ed25519",
					publicKey: ed25519KeyPair.publicKey,
				},
				dataKey,
			),
		).toThrow(/Raw public key bytes are required/)
	})

	test("throws without raw seed for ed25519 decryption", () => {
		const dataKey = crypto.randomBytes(32)
		const encrypted = encryptDataKey(
			{
				algorithm: "ed25519",
				publicKey: ed25519KeyPair.publicKey,
				rawPublicKey,
			},
			dataKey,
		)
		expect(() =>
			decryptDataKey(
				{
					algorithm: "ed25519",
					privateKey: ed25519KeyPair.privateKey,
				},
				encrypted,
			),
		).toThrow(/Raw seed bytes are required/)
	})
})

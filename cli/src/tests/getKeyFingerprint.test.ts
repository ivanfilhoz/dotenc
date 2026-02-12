import crypto from "node:crypto"
import { describe, expect, test } from "vitest"
import { getKeyFingerprint } from "../helpers/getKeyFingerprint"

const rsaKeyPair = crypto.generateKeyPairSync("rsa", {
	modulusLength: 2048,
})

const ed25519KeyPair = crypto.generateKeyPairSync("ed25519")

describe("getKeyFingerprint", () => {
	test("returns the same fingerprint for RSA public and private key", () => {
		const pub = rsaKeyPair.publicKey
		const priv = rsaKeyPair.privateKey
		const pubFp = getKeyFingerprint(pub)
		const privFp = getKeyFingerprint(priv)
		expect(pubFp).toBe(privFp)
	})

	test("returns the same fingerprint for RSA PEM and KeyObject", () => {
		const pubPem = rsaKeyPair.publicKey.export({ type: "spki", format: "pem" })
		const pubFp1 = getKeyFingerprint(pubPem)
		const pubFp2 = getKeyFingerprint(rsaKeyPair.publicKey)
		expect(pubFp1).toBe(pubFp2)
	})

	test("returns the same fingerprint for Ed25519 public and private key", () => {
		const pub = ed25519KeyPair.publicKey
		const priv = ed25519KeyPair.privateKey
		const pubFp = getKeyFingerprint(pub)
		const privFp = getKeyFingerprint(priv)
		expect(pubFp).toBe(privFp)
	})

	test("returns the same fingerprint for Ed25519 PEM and KeyObject", () => {
		const pubPem = ed25519KeyPair.publicKey.export({
			type: "spki",
			format: "pem",
		})
		const pubFp1 = getKeyFingerprint(pubPem)
		const pubFp2 = getKeyFingerprint(ed25519KeyPair.publicKey)
		expect(pubFp1).toBe(pubFp2)
	})

	test("RSA and Ed25519 fingerprints are different", () => {
		const rsaFp = getKeyFingerprint(rsaKeyPair.publicKey)
		const ed25519Fp = getKeyFingerprint(ed25519KeyPair.publicKey)
		expect(rsaFp).not.toBe(ed25519Fp)
	})

	test("throws for invalid input", () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing purposes
		expect(() => getKeyFingerprint("not a key" as any)).toThrow()
	})
})

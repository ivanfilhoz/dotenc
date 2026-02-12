import crypto from "node:crypto"
import { describe, expect, test } from "vitest"
import { getKeyFingerprint } from "../helpers/getKeyFingerprint"

const keyPair = crypto.generateKeyPairSync("rsa", {
	modulusLength: 2048,
})

describe("getKeyFingerprint", () => {
	test("returns the same fingerprint for public and private key", () => {
		const pub = keyPair.publicKey
		const priv = keyPair.privateKey
		const pubFp = getKeyFingerprint(pub)
		const privFp = getKeyFingerprint(priv)
		expect(pubFp).toBe(privFp)
	})

	test("returns the same fingerprint for PEM and KeyObject", () => {
		const pubPem = keyPair.publicKey.export({ type: "spki", format: "pem" })
		const pubFp1 = getKeyFingerprint(pubPem)
		const pubFp2 = getKeyFingerprint(keyPair.publicKey)
		expect(pubFp1).toBe(pubFp2)
	})

	test("throws for invalid input", () => {
		// biome-ignore lint/suspicious/noExplicitAny: testing purposes
		expect(() => getKeyFingerprint("not a key" as any)).toThrow()
	})
})

import { describe, expect, test } from "bun:test"
import crypto from "node:crypto"
import { getCurrentKeyName } from "../helpers/getCurrentKeyName"
import type { PrivateKeyEntry } from "../helpers/getPrivateKeys"
import type { PublicKeyEntry } from "../helpers/getPublicKeys"

const ed25519KeyPair = crypto.generateKeyPairSync("ed25519")
const ed25519KeyPair2 = crypto.generateKeyPairSync("ed25519")

function fingerprint(key: crypto.KeyObject): string {
	const pub = key.type === "public" ? key : crypto.createPublicKey(key)
	const der = pub.export({ type: "spki", format: "der" }) as Buffer
	return crypto.createHash("sha256").update(der).digest("hex")
}

function makePrivateEntry(
	name: string,
	keyPair: { privateKey: crypto.KeyObject },
): PrivateKeyEntry {
	return {
		name,
		privateKey: keyPair.privateKey,
		fingerprint: fingerprint(keyPair.privateKey),
		algorithm: "ed25519",
	}
}

function makePublicEntry(
	name: string,
	keyPair: { publicKey: crypto.KeyObject },
): PublicKeyEntry {
	return {
		name,
		publicKey: keyPair.publicKey,
		fingerprint: fingerprint(keyPair.publicKey),
		algorithm: "ed25519",
	}
}

describe("getCurrentKeyName", () => {
	test("returns matching public key name", async () => {
		const result = await getCurrentKeyName({
			getPrivateKeys: async () => ({
				keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
				passphraseProtectedKeys: [],
			}),
			getPublicKeys: async () => [makePublicEntry("alice", ed25519KeyPair)],
		})
		expect(result).toEqual(["alice"])
	})

	test("returns empty array when no fingerprints match", async () => {
		const result = await getCurrentKeyName({
			getPrivateKeys: async () => ({
				keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
				passphraseProtectedKeys: [],
			}),
			getPublicKeys: async () => [makePublicEntry("bob", ed25519KeyPair2)],
		})
		expect(result).toEqual([])
	})

	test("returns empty array when no public keys exist", async () => {
		const result = await getCurrentKeyName({
			getPrivateKeys: async () => ({
				keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
				passphraseProtectedKeys: [],
			}),
			getPublicKeys: async () => [],
		})
		expect(result).toEqual([])
	})

	test("returns empty array when no private keys exist", async () => {
		const result = await getCurrentKeyName({
			getPrivateKeys: async () => ({
				keys: [],
				passphraseProtectedKeys: [],
			}),
			getPublicKeys: async () => [makePublicEntry("alice", ed25519KeyPair)],
		})
		expect(result).toEqual([])
	})

	test("returns all matching keys when multiple public keys match", async () => {
		const result = await getCurrentKeyName({
			getPrivateKeys: async () => ({
				keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
				passphraseProtectedKeys: [],
			}),
			getPublicKeys: async () => [
				makePublicEntry("bob", ed25519KeyPair2),
				makePublicEntry("alice", ed25519KeyPair),
			],
		})
		expect(result).toEqual(["alice"])
	})

	test("returns multiple names when multiple public keys match the same private key", async () => {
		const result = await getCurrentKeyName({
			getPrivateKeys: async () => ({
				keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
				passphraseProtectedKeys: [],
			}),
			getPublicKeys: async () => [
				makePublicEntry("alice", ed25519KeyPair),
				makePublicEntry("alice-deploy", ed25519KeyPair),
			],
		})
		expect(result).toEqual(["alice", "alice-deploy"])
	})
})

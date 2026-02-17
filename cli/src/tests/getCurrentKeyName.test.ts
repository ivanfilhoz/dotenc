import { afterEach, describe, expect, mock, test } from "bun:test"
import crypto from "node:crypto"
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
	afterEach(() => {
		mock.restore()
	})

	test("returns matching public key name", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({
					keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
					passphraseProtectedKeys: [],
				}),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () =>
				Promise.resolve([makePublicEntry("alice", ed25519KeyPair)]),
		}))

		const { getCurrentKeyName } = await import("../helpers/getCurrentKeyName")
		const result = await getCurrentKeyName()
		expect(result).toBe("alice")
	})

	test("returns undefined when no fingerprints match", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({
					keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
					passphraseProtectedKeys: [],
				}),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () =>
				Promise.resolve([makePublicEntry("bob", ed25519KeyPair2)]),
		}))

		const { getCurrentKeyName } = await import("../helpers/getCurrentKeyName")
		const result = await getCurrentKeyName()
		expect(result).toBeUndefined()
	})

	test("returns undefined when no public keys exist", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({
					keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
					passphraseProtectedKeys: [],
				}),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () => Promise.resolve([]),
		}))

		const { getCurrentKeyName } = await import("../helpers/getCurrentKeyName")
		const result = await getCurrentKeyName()
		expect(result).toBeUndefined()
	})

	test("returns undefined when no private keys exist", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({ keys: [], passphraseProtectedKeys: [] }),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () =>
				Promise.resolve([makePublicEntry("alice", ed25519KeyPair)]),
		}))

		const { getCurrentKeyName } = await import("../helpers/getCurrentKeyName")
		const result = await getCurrentKeyName()
		expect(result).toBeUndefined()
	})

	test("returns first matching key when multiple public keys exist", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({
					keys: [makePrivateEntry("id_ed25519", ed25519KeyPair)],
					passphraseProtectedKeys: [],
				}),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () =>
				Promise.resolve([
					makePublicEntry("bob", ed25519KeyPair2),
					makePublicEntry("alice", ed25519KeyPair),
				]),
		}))

		const { getCurrentKeyName } = await import("../helpers/getCurrentKeyName")
		const result = await getCurrentKeyName()
		expect(result).toBe("alice")
	})
})

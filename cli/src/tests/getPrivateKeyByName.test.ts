import { afterEach, describe, expect, mock, test } from "bun:test"
import crypto from "node:crypto"
import type { PrivateKeyEntry } from "../helpers/getPrivateKeys"

const ed25519KeyPair = crypto.generateKeyPairSync("ed25519")

function fingerprint(key: crypto.KeyObject): string {
	const pub = key.type === "public" ? key : crypto.createPublicKey(key)
	const der = pub.export({ type: "spki", format: "der" }) as Buffer
	return crypto.createHash("sha256").update(der).digest("hex")
}

const entry: PrivateKeyEntry = {
	name: "id_ed25519",
	privateKey: ed25519KeyPair.privateKey,
	fingerprint: fingerprint(ed25519KeyPair.privateKey),
	algorithm: "ed25519",
}

describe("getPrivateKeyByName", () => {
	afterEach(() => {
		mock.restore()
	})

	test("returns matching private key entry", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({ keys: [entry], passphraseProtectedKeys: [] }),
		}))

		const { getPrivateKeyByName } = await import(
			"../helpers/getPrivateKeyByName"
		)
		const result = await getPrivateKeyByName("id_ed25519")
		expect(result.name).toBe("id_ed25519")
		expect(result.algorithm).toBe("ed25519")
	})

	test("throws when key name is not found", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({ keys: [entry], passphraseProtectedKeys: [] }),
		}))

		const { getPrivateKeyByName } = await import(
			"../helpers/getPrivateKeyByName"
		)
		await expect(getPrivateKeyByName("id_rsa")).rejects.toThrow(
			/No SSH private key found with name id_rsa/,
		)
	})

	test("throws with empty key list", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({ keys: [], passphraseProtectedKeys: [] }),
		}))

		const { getPrivateKeyByName } = await import(
			"../helpers/getPrivateKeyByName"
		)
		await expect(getPrivateKeyByName("anything")).rejects.toThrow(
			/No SSH private key found/,
		)
	})
})

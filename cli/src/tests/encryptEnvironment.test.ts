import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import crypto from "node:crypto"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import { decryptData } from "../helpers/crypto"
import { decryptDataKey } from "../helpers/decryptDataKey"
import { encryptEnvironment } from "../helpers/encryptEnvironment"
import { getKeyFingerprint } from "../helpers/getKeyFingerprint"
import type { Environment } from "../schemas/environment"

type KeyPair = {
	publicKey: crypto.KeyObject
	privateKey: crypto.KeyObject
}

const toBase64 = (value: string) =>
	Buffer.from(value, "utf-8").toString("base64")

const writePublicKey = (
	tmpDir: string,
	name: string,
	keyPair: KeyPair,
): { name: string; fingerprint: string; privateKey: crypto.KeyObject } => {
	writeFileSync(
		path.join(tmpDir, ".dotenc", `${name}.pub`),
		keyPair.publicKey.export({ type: "spki", format: "pem" }).toString(),
		"utf-8",
	)

	return {
		name,
		fingerprint: getKeyFingerprint(keyPair.publicKey),
		privateKey: keyPair.privateKey,
	}
}

const writeEnvironmentFile = (
	tmpDir: string,
	environmentName: string,
	environment: Environment,
) => {
	writeFileSync(
		path.join(tmpDir, `.env.${environmentName}.enc`),
		JSON.stringify(environment, null, 2),
		"utf-8",
	)
}

describe("encryptEnvironment", () => {
	let tmpDir: string
	let cwdSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-encrypt-environment-"))
		mkdirSync(path.join(tmpDir, ".dotenc"))
		cwdSpy = spyOn(process, "cwd").mockReturnValue(tmpDir)
	})

	afterEach(() => {
		cwdSpy.mockRestore()
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("throws when no public keys are available", async () => {
		await expect(
			encryptEnvironment("development", "API_KEY=abc123"),
		).rejects.toThrow("No public keys found")
	})

	test("throws when all keys are revoked", async () => {
		const alice = writePublicKey(
			tmpDir,
			"alice",
			crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
		)

		writeEnvironmentFile(tmpDir, "staging", {
			keys: [
				{
					name: "alice",
					fingerprint: alice.fingerprint,
					encryptedDataKey: toBase64("old-data-key"),
					algorithm: "rsa",
				},
			],
			encryptedContent: toBase64("old-content"),
		})

		const logSpy = spyOn(console, "log").mockImplementation(() => {})

		await expect(
			encryptEnvironment("staging", "TOKEN=xyz", {
				revokePublicKeys: ["alice"],
			}),
		).rejects.toThrow("No valid public keys are left")

		expect(
			logSpy.mock.calls.some((call) => String(call[0]).includes("revoked")),
		).toBe(true)
		logSpy.mockRestore()
	})

	test("handles removed keys, renames, grants, and writes decryptable content", async () => {
		const primaryKeyPair = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
		})
		const bobKeyPair = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
		})
		const carolKeyPair = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
		})

		const aliceA = writePublicKey(tmpDir, "alice-a", primaryKeyPair)
		const aliceB = writePublicKey(tmpDir, "alice-b", primaryKeyPair)
		const bob = writePublicKey(tmpDir, "bob", bobKeyPair)
		const carol = writePublicKey(tmpDir, "carol", carolKeyPair)

		writeEnvironmentFile(tmpDir, "production", {
			keys: [
				{
					name: "old-alice",
					fingerprint: aliceA.fingerprint,
					encryptedDataKey: toBase64("old-key-a"),
					algorithm: "rsa",
				},
				{
					name: "bob",
					fingerprint: bob.fingerprint,
					encryptedDataKey: toBase64("old-key-b"),
					algorithm: "rsa",
				},
				{
					name: "removed-user",
					fingerprint: "missing-fingerprint",
					encryptedDataKey: toBase64("old-key-missing"),
					algorithm: "rsa",
				},
			],
			encryptedContent: toBase64("old-content"),
		})

		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		const errorSpy = spyOn(console, "error").mockImplementation(() => {})

		await encryptEnvironment("production", "API_KEY=new-value", {
			grantPublicKeys: ["unknown", "alice-a", "alice-b", "bob", "carol"],
		})

		const parsed = JSON.parse(
			readFileSync(path.join(tmpDir, ".env.production.enc"), "utf-8"),
		) as Environment

		expect(parsed.keys).toHaveLength(3)
		expect(
			parsed.keys.find((key) => key.fingerprint === bob.fingerprint),
		).toBeDefined()
		expect(
			parsed.keys.find((key) => key.fingerprint === aliceA.fingerprint),
		).toBeDefined()
		expect(
			parsed.keys.find((key) => key.fingerprint === carol.fingerprint),
		).toBeDefined()

		const bobEntry = parsed.keys.find((key) => key.name === "bob")
		expect(bobEntry).toBeDefined()

		const dataKey = decryptDataKey(
			{
				algorithm: "rsa",
				privateKey: bob.privateKey,
			},
			Buffer.from(bobEntry?.encryptedDataKey ?? "", "base64"),
		)
		const decryptedContent = await decryptData(
			dataKey,
			Buffer.from(parsed.encryptedContent, "base64"),
		)
		expect(decryptedContent).toBe("API_KEY=new-value")

		expect(
			logSpy.mock.calls.some((call) =>
				String(call[0]).includes("removed from the environment"),
			),
		).toBe(true)
		expect(
			logSpy.mock.calls.some((call) => String(call[0]).includes("renamed to")),
		).toBe(true)
		expect(
			logSpy.mock.calls.some((call) =>
				String(call[0]).includes("already has access to the environment"),
			),
		).toBe(true)
		expect(
			logSpy.mock.calls.some((call) =>
				String(call[0]).includes("has been granted access to the environment"),
			),
		).toBe(true)
		expect(
			errorSpy.mock.calls.some((call) => String(call[0]).includes("not found")),
		).toBe(true)

		const allNames = parsed.keys.map((key) => key.name)
		expect(
			allNames.includes(aliceA.name) || allNames.includes(aliceB.name),
		).toBe(true)

		logSpy.mockRestore()
		errorSpy.mockRestore()
	})
})

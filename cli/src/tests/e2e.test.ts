import crypto from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, mock, spyOn, test } from "bun:test"
import { createCommand } from "../commands/create"
import { editCommand } from "../commands/edit"
import { grantCommand } from "../commands/grant"
import { initCommand } from "../commands/init"
import { keyAddCommand } from "../commands/key/add"
import { revokeCommand } from "../commands/revoke"
import { runCommand } from "../commands/run"
import { getKeyFingerprint } from "../helpers/getKeyFingerprint"
import { environmentSchema } from "../schemas/environment"
import { unlinkIfExists } from "./helpers/unlinkIfExists"
import { waitForFile } from "./helpers/waitForFile"

// Generate test Ed25519 key pair
const ed25519KeyPair = crypto.generateKeyPairSync("ed25519")
const ed25519PrivatePem = ed25519KeyPair.privateKey
	.export({ type: "pkcs8", format: "pem" })
	.toString()
const ed25519PrivDer = ed25519KeyPair.privateKey.export({
	type: "pkcs8",
	format: "der",
})
const ed25519RawSeed = Buffer.from(
	ed25519PrivDer.subarray(ed25519PrivDer.length - 32),
)
const ed25519PubDer = ed25519KeyPair.publicKey.export({
	type: "spki",
	format: "der",
})
const ed25519RawPublicKey = Buffer.from(
	ed25519PubDer.subarray(ed25519PubDer.length - 32),
)

// Generate a second Ed25519 key pair for grant/revoke tests
const aliceKeyPair = crypto.generateKeyPairSync("ed25519")

// Set up file paths
const localEnvFilePath = path.join(process.cwd(), ".env")
const encryptedEnvFilePath = path.join(process.cwd(), ".env.test.enc")
const projectFilePath = path.join(process.cwd(), "dotenc.json")
const outputFilePath = path.join(process.cwd(), "e2e.txt")
const publicKeyPath = path.join(process.cwd(), ".dotenc", "id_ed25519.pub")
const newPublicKeyPath = path.join(process.cwd(), ".dotenc", "alice.pub")

// Write a temp SSH key to a temp directory for the test
const testSshDir = path.join(os.tmpdir(), ".dotenc-test-ssh")
const testSshKeyPath = path.join(testSshDir, "id_ed25519")

mock.module("node:child_process", () => ({
	// Mock for the edit command
	spawnSync: () => {
		const tempFilePath = path.join(os.tmpdir(), ".env.test")
		writeFileSync(tempFilePath, "DOTENC_HELLO=Hello, world!")
		return { status: 0, error: null }
	},
}))

// Mock getPrivateKeys to return our test key instead of scanning ~/.ssh/
mock.module("../helpers/getPrivateKeys", () => ({
	getPrivateKeys: async () => [
		{
			name: "id_ed25519",
			privateKey: ed25519KeyPair.privateKey,
			fingerprint: getKeyFingerprint(ed25519KeyPair.privateKey),
			algorithm: "ed25519" as const,
			rawSeed: ed25519RawSeed,
			rawPublicKey: ed25519RawPublicKey,
		},
	],
}))

describe("e2e", () => {
	beforeAll(async () => {
		spyOn(console, "log").mockImplementation(() => {})
		spyOn(process, "exit").mockImplementation(() => ({}) as never)

		// Write the test SSH key to disk for init to use
		if (!existsSync(testSshDir)) {
			await fs.mkdir(testSshDir, { recursive: true })
		}
		await fs.writeFile(testSshKeyPath, ed25519PrivatePem, { mode: 0o600 })
	})

	test("should initialize a project", async () => {
		await initCommand()
		expect(existsSync(localEnvFilePath)).toBe(true)
		expect(existsSync(projectFilePath)).toBe(true)
		expect(existsSync(publicKeyPath)).toBe(true)
	})

	test("should create a new environment", async () => {
		await createCommand("test", "id_ed25519")
		expect(existsSync(encryptedEnvFilePath)).toBe(true)

		// Verify the environment schema includes algorithm
		const content = readFileSync(encryptedEnvFilePath, "utf-8")
		const parsed = environmentSchema.parse(JSON.parse(content))
		expect(parsed.keys[0].algorithm).toBe("ed25519")
	})

	test("should edit an environment", async () => {
		const initialContent = readFileSync(encryptedEnvFilePath, "utf-8")
		await editCommand("test")
		const editedContent = readFileSync(encryptedEnvFilePath, "utf-8")
		expect(editedContent).not.toBe(initialContent)
	})

	test("should run a command in an environment", async () => {
		await runCommand("sh", [path.join(__dirname, "helpers", "e2e.sh")], {
			env: "test",
		})
		const output = await waitForFile(outputFilePath)
		expect(output).toBe("Hello, world!\n")
	})

	test("should add a new public key", async () => {
		const publicKeyPem = aliceKeyPair.publicKey
			.export({ type: "spki", format: "pem" })
			.toString()
		await keyAddCommand("alice", {
			fromString: publicKeyPem,
		})
		expect(existsSync(newPublicKeyPath)).toBe(true)
	})

	test("should grant access to an environment", async () => {
		const fingerprint = getKeyFingerprint(readFileSync(newPublicKeyPath))
		await grantCommand("test", "alice")
		const content = readFileSync(encryptedEnvFilePath, "utf-8")
		const parsedContent = environmentSchema.parse(JSON.parse(content))
		expect(parsedContent.keys).toContainEqual({
			name: "alice",
			fingerprint,
			encryptedDataKey: expect.any(String),
			algorithm: "ed25519",
		})
	})

	test("should revoke access from an environment", async () => {
		const fingerprint = getKeyFingerprint(readFileSync(newPublicKeyPath))
		await revokeCommand("test", "alice")
		const content = readFileSync(encryptedEnvFilePath, "utf-8")
		const parsedContent = environmentSchema.parse(JSON.parse(content))
		expect(parsedContent.keys).not.toContainEqual({
			name: "alice",
			fingerprint,
			encryptedDataKey: expect.any(String),
			algorithm: "ed25519",
		})
	})

	afterAll(async () => {
		unlinkIfExists(localEnvFilePath)
		unlinkIfExists(encryptedEnvFilePath)
		unlinkIfExists(projectFilePath)
		unlinkIfExists(outputFilePath)
		unlinkIfExists(publicKeyPath)
		unlinkIfExists(newPublicKeyPath)
		unlinkIfExists(testSshKeyPath)

		// Clean up .dotenc dir if empty
		const dotencDir = path.join(process.cwd(), ".dotenc")
		if (existsSync(dotencDir)) {
			const files = await fs.readdir(dotencDir)
			if (!files.length) {
				await fs.rmdir(dotencDir)
			}
		}
	})
})

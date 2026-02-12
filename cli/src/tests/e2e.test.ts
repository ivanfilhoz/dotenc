import { existsSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import { createCommand } from "../commands/create"
import { editCommand } from "../commands/edit"
import { grantCommand } from "../commands/grant"
import { initCommand } from "../commands/init"
import { keyAddCommand } from "../commands/key/add"
import { keyGenerateCommand } from "../commands/key/generate"
import { revokeCommand } from "../commands/revoke"
import { runCommand } from "../commands/run"
import { generateKeyPair } from "../helpers/crypto"
import { getKeyFingerprint } from "../helpers/getKeyFingerprint"
import { environmentSchema } from "../schemas/environment"
import { unlinkIfExists } from "./helpers/unlinkIfExists"
import { waitForFile } from "./helpers/waitForFile"

const localEnvFilePath = path.join(process.cwd(), ".env")
const encryptedEnvFilePath = path.join(process.cwd(), ".env.test.enc")
const projectFilePath = path.join(process.cwd(), "dotenc.json")
const outputFilePath = path.join(process.cwd(), "e2e.txt")
const privateKeyPath = path.join(os.homedir(), ".dotenc", "john.pem")
const publicKeyPath = path.join(process.cwd(), ".dotenc", "john.pub")
const newPublicKeyPath = path.join(process.cwd(), ".dotenc", "alice.pub")

vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>()
	return {
		...actual,
		// Mock for the edit command
		execSync: () => {
			const tempFilePath = path.join(os.tmpdir(), ".env.test")
			writeFileSync(tempFilePath, "DOTENC_HELLO=Hello, world!")
		},
	}
})

describe("e2e", () => {
	beforeAll(() => {
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(process, "exit").mockImplementation(() => ({}) as never)
		unlinkIfExists(privateKeyPath)
	})

	test("should generate a private key", async () => {
		await keyGenerateCommand("john")
		expect(existsSync(privateKeyPath)).toBe(true)
	})

	test("should initialize a project", async () => {
		await initCommand()
		expect(existsSync(localEnvFilePath)).toBe(true)
		expect(existsSync(projectFilePath)).toBe(true)
		expect(existsSync(publicKeyPath)).toBe(true)
	})

	test("should create a new environment", async () => {
		await createCommand("test", "john")
		expect(existsSync(encryptedEnvFilePath)).toBe(true)
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
		const { publicKey } = await generateKeyPair()
		await keyAddCommand("alice", {
			fromString: publicKey.toString(),
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
		})
	})

	afterAll(async () => {
		unlinkIfExists(privateKeyPath)
		unlinkIfExists(localEnvFilePath)
		unlinkIfExists(encryptedEnvFilePath)
		unlinkIfExists(projectFilePath)
		unlinkIfExists(outputFilePath)
		unlinkIfExists(publicKeyPath)
		unlinkIfExists(newPublicKeyPath)
	})
})

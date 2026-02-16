import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generateRsaKey, runCli, createMockEditor } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Mixed Keys", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-05-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-05-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-05-workspace-"))
		generateEd25519Key(aliceHome)
		generateRsaKey(bobHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("Alice inits and creates env", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
	}, TIMEOUT)

	test("Alice edits env", () => {
		const editor = createMockEditor("SHARED_SECRET=mix123")
		runCli(aliceHome, workspace, ["env", "edit", "staging"], { EDITOR: editor })
	}, TIMEOUT)

	test("Alice adds Bob's RSA key and grants access", () => {
		runCli(aliceHome, workspace, ["key", "add", "bob", "--from-ssh", path.join(bobHome, ".ssh", "id_rsa")])
		runCli(aliceHome, workspace, ["auth", "grant", "staging", "bob"])

		const env = JSON.parse(readFileSync(path.join(workspace, ".env.staging.enc"), "utf-8"))
		expect(env.keys).toHaveLength(2)
		expect(env.keys[0].algorithm).toBe("ed25519")
		expect(env.keys[1].algorithm).toBe("rsa")
	}, TIMEOUT)

	test("Alice can decrypt", () => {
		const result = runCli(aliceHome, workspace, ["run", "-e", "staging", "--", "sh", "-c", "echo $SHARED_SECRET"])
		expect(result.stdout).toContain("mix123")
	}, TIMEOUT)

	test("Bob can decrypt", () => {
		const result = runCli(bobHome, workspace, ["run", "-e", "staging", "--", "sh", "-c", "echo $SHARED_SECRET"])
		expect(result.stdout).toContain("mix123")
	}, TIMEOUT)
})

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generateRsaKey, runCli, createMockEditor } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Multi-User", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-03-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-03-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-03-workspace-"))
		generateEd25519Key(aliceHome)
		generateRsaKey(bobHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("Alice inits project and creates production env", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		expect(existsSync(path.join(workspace, "dotenc.json"))).toBe(true)

		runCli(aliceHome, workspace, ["env", "create", "production", "alice"])
	}, TIMEOUT)

	test("Alice edits production env", () => {
		const editor = createMockEditor("API_KEY=super-secret-key")
		runCli(aliceHome, workspace, ["env", "edit", "production"], { EDITOR: editor })
	}, TIMEOUT)

	test("Alice adds Bob's public key", () => {
		runCli(aliceHome, workspace, ["key", "add", "bob", "--from-ssh", path.join(bobHome, ".ssh", "id_rsa")])
		expect(existsSync(path.join(workspace, ".dotenc", "bob.pub"))).toBe(true)
	}, TIMEOUT)

	test("Alice grants Bob access", () => {
		runCli(aliceHome, workspace, ["auth", "grant", "production", "bob"])
		const env = JSON.parse(readFileSync(path.join(workspace, ".env.production.enc"), "utf-8"))
		expect(env.keys).toHaveLength(2)
	}, TIMEOUT)

	test("Bob can decrypt after grant", () => {
		const result = runCli(bobHome, workspace, ["run", "-e", "production", "--", "sh", "-c", "echo $API_KEY"])
		expect(result.stdout).toContain("super-secret-key")
	}, TIMEOUT)

	test("Alice revokes Bob", () => {
		runCli(aliceHome, workspace, ["auth", "revoke", "production", "bob"])
		const env = JSON.parse(readFileSync(path.join(workspace, ".env.production.enc"), "utf-8"))
		expect(env.keys).toHaveLength(1)
	}, TIMEOUT)

	test("Bob cannot decrypt after revocation", () => {
		const result = runCli(bobHome, workspace, ["run", "-e", "production", "--", "sh", "-c", "echo $API_KEY"])
		expect(result.stdout).not.toContain("super-secret-key")
	}, TIMEOUT)
})

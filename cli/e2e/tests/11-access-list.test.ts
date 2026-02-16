import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generateRsaKey, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Access List", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-11-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-11-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-11-workspace-"))
		generateEd25519Key(aliceHome)
		generateRsaKey(bobHome)

		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
		runCli(aliceHome, workspace, ["key", "add", "bob", "--from-ssh", path.join(bobHome, ".ssh", "id_rsa")])
		runCli(aliceHome, workspace, ["auth", "grant", "staging", "bob"])
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("access list shows all keys with access", () => {
		const result = runCli(aliceHome, workspace, ["auth", "list", "staging"])
		expect(result.stdout).toContain("alice")
		expect(result.stdout).toContain("bob")
	}, TIMEOUT)

	test("access list for env with only alice does not show bob", () => {
		runCli(aliceHome, workspace, ["env", "create", "production", "alice"])
		const result = runCli(aliceHome, workspace, ["auth", "list", "production"])
		expect(result.stdout).toContain("alice")
		expect(result.stdout).not.toContain("bob")
	}, TIMEOUT)
})

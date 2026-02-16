import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generateRsaKey, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Key List", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-15-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-15-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-15-workspace-"))
		generateEd25519Key(aliceHome)
		generateRsaKey(bobHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("init project and add a second key", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, [
			"key", "add", "bob", "--from-ssh",
			path.join(bobHome, ".ssh", "id_rsa"),
		])
	}, TIMEOUT)

	test("key list shows both keys with algorithms", () => {
		const result = runCli(aliceHome, workspace, ["key", "list"])
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("alice")
		expect(result.stdout).toContain("ed25519")
		expect(result.stdout).toContain("bob")
		expect(result.stdout).toContain("rsa")
	}, TIMEOUT)
})

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, generateRsaKey, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Whoami Command", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-09-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-09-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-09-workspace-"))
		generateEd25519Key(aliceHome)
		generateRsaKey(bobHome)

		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("whoami shows the current user's name", () => {
		const result = runCli(aliceHome, workspace, ["whoami"])
		expect(result.stdout).toContain("Name: alice")
	}, TIMEOUT)

	test("whoami shows authorized environments", () => {
		const result = runCli(aliceHome, workspace, ["whoami"])
		expect(result.stdout).toContain("staging")
	}, TIMEOUT)

	test("whoami fails with no matching key", () => {
		const result = runCli(bobHome, workspace, ["whoami"])
		expect(result.stderr).toContain("No matching key found")
	}, TIMEOUT)

	test("whoami shows multiple matching identities", () => {
		// Add the same SSH key under a second name
		runCli(aliceHome, workspace, ["key", "add", "alice-deploy", "--from-ssh", path.join(aliceHome, ".ssh", "id_ed25519")])

		const result = runCli(aliceHome, workspace, ["whoami"])
		expect(result.stdout).toContain("Name: alice")
		expect(result.stdout).toContain("Name: alice-deploy")
	}, TIMEOUT)
})

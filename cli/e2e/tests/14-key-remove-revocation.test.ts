import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Key Remove with Auto-Revocation", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-14-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-14-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-14-workspace-"))
		generateEd25519Key(aliceHome)
		generateEd25519Key(bobHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("Alice inits and creates staging env", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
	}, TIMEOUT)

	test("Alice adds Bob's key and grants access", () => {
		runCli(aliceHome, workspace, [
			"key", "add", "bob", "--from-ssh",
			path.join(bobHome, ".ssh", "id_ed25519"),
		])
		runCli(aliceHome, workspace, ["auth", "grant", "staging", "bob"])
	}, TIMEOUT)

	test("Bob can decrypt staging", () => {
		const result = runCli(bobHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo ok",
		])
		expect(result.stdout).toContain("ok")
	}, TIMEOUT)

	test("Alice removes Bob's key (piping yes to confirm)", () => {
		// Create a script that auto-confirms
		const confirmScript = path.join(os.tmpdir(), `confirm-${Date.now()}.sh`)
		writeFileSync(confirmScript, `#!/bin/bash\necho "y" | bun /app/cli/src/cli.ts key remove bob\n`)

		const result = Bun.spawnSync(["bash", confirmScript], {
			cwd: workspace,
			env: { ...process.env, HOME: aliceHome },
		})

		expect(existsSync(path.join(workspace, ".dotenc", "bob.pub"))).toBe(false)
	}, TIMEOUT)

	test("Bob can no longer decrypt staging after auto-revocation", () => {
		const result = runCli(bobHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo secret",
		])
		expect(result.stdout).not.toContain("secret")
	}, TIMEOUT)

	test("Alice can still decrypt staging", () => {
		const result = runCli(aliceHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo ok",
		])
		expect(result.stdout).toContain("ok")
	}, TIMEOUT)
})

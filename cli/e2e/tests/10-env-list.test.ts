import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Env List", () => {
	let home: string
	let workspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-10-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-10-workspace-"))
		generateEd25519Key(home)

		runCli(home, workspace, ["init", "--name", "alice"])
		runCli(home, workspace, ["env", "create", "staging", "alice"])
		runCli(home, workspace, ["env", "create", "production", "alice"])
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("env list shows all environments", () => {
		const result = runCli(home, workspace, ["env", "list"])
		expect(result.stdout).toContain("staging")
		expect(result.stdout).toContain("production")
		expect(result.stdout).toContain("alice")
	}, TIMEOUT)
})

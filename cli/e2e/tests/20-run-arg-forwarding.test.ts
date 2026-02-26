import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Run Command Argument Forwarding", () => {
	let home: string
	let workspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-20-home-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-20-workspace-"))
		generateEd25519Key(home)
		runCli(home, workspace, ["init", "--name", "alice"])
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("forwards child command flags without requiring -- separator", () => {
		const result = runCli(home, workspace, [
			"run", "-e", "development", "echo", "ok", "--foo",
		])

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("ok --foo")
		expect(result.stderr).not.toContain("unknown option '--foo'")
	}, TIMEOUT)
})

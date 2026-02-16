import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli, createMockEditor } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Partial Environment Warning", () => {
	let home: string
	let workspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-16-home-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-16-workspace-"))
		generateEd25519Key(home)
		runCli(home, workspace, ["init", "--name", "alice"])
		runCli(home, workspace, ["env", "create", "staging", "alice"])
		const editor = createMockEditor("STAGE_VAR=hello")
		runCli(home, workspace, ["env", "edit", "staging"], { EDITOR: editor })
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("partial failure shows warning", () => {
		const result = runCli(home, workspace, [
			"run", "-e", "staging,nonexistent", "--", "sh", "-c", "echo $STAGE_VAR",
		])
		expect(result.stderr).toContain("1 of 2 environment(s) failed")
		expect(result.stdout).toContain("hello")
	}, TIMEOUT)

	test("all environments failing exits with error", () => {
		const result = runCli(home, workspace, [
			"run", "-e", "nonexistent", "--", "echo", "ok",
		])
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("All environments failed")
	}, TIMEOUT)
})

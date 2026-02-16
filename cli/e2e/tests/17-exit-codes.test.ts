import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Exit Codes", () => {
	let home: string
	let workspace: string
	let emptyWorkspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-17-home-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-17-workspace-"))
		emptyWorkspace = mkdtempSync(path.join(os.tmpdir(), "e2e-17-empty-"))
		generateEd25519Key(home)
		runCli(home, workspace, ["init", "--name", "alice"])
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
		rmSync(emptyWorkspace, { recursive: true, force: true })
	})

	test("run with nonexistent env exits with code 1", () => {
		const result = runCli(home, workspace, [
			"run", "-e", "nonexistent", "--", "echo", "ok",
		])
		expect(result.exitCode).not.toBe(0)
	}, TIMEOUT)

	test("env edit with nonexistent env exits with code 1", () => {
		const result = runCli(home, workspace, ["env", "edit", "nonexistent"])
		expect(result.exitCode).not.toBe(0)
	}, TIMEOUT)

	test("dev without init exits with code 1", () => {
		const result = runCli(home, emptyWorkspace, ["dev", "echo", "ok"])
		expect(result.exitCode).not.toBe(0)
	}, TIMEOUT)
})

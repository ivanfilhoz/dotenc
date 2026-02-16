import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Environment Name Validation", () => {
	let home: string
	let workspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-13-home-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-13-workspace-"))
		generateEd25519Key(home)
		runCli(home, workspace, ["init", "--name", "alice"])
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("env create rejects path traversal", () => {
		const result = runCli(home, workspace, ["env", "create", "../traversal", "alice"])
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("Invalid environment name")
	}, TIMEOUT)

	test("env create rejects names with spaces", () => {
		const result = runCli(home, workspace, ["env", "create", "foo bar", "alice"])
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("Invalid environment name")
	}, TIMEOUT)

	test("env create accepts valid name", () => {
		const result = runCli(home, workspace, ["env", "create", "valid-name", "alice"])
		expect(result.exitCode).toBe(0)
	}, TIMEOUT)

	test("run rejects path traversal in env name", () => {
		const result = runCli(home, workspace, ["run", "-e", "../etc/passwd", "--", "echo", "ok"])
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("Invalid environment name")
	}, TIMEOUT)

	test("run rejects path traversal in comma-separated env names", () => {
		const result = runCli(home, workspace, ["run", "-e", "dev,../bad", "--", "echo", "ok"])
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("Invalid environment name")
	}, TIMEOUT)
})

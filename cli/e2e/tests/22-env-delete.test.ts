import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, existsSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("env delete", () => {
	let aliceHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-22-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-22-workspace-"))
		generateEd25519Key(aliceHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("init and create staging env", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
		expect(existsSync(path.join(workspace, ".env.staging.enc"))).toBe(true)
	}, TIMEOUT)

	test("env delete staging --yes exits with code 0", () => {
		const result = runCli(aliceHome, workspace, [
			"env", "delete", "staging", "--yes",
		])
		expect(result.exitCode).toBe(0)
	}, TIMEOUT)

	test(".env.staging.enc no longer exists after delete", () => {
		expect(existsSync(path.join(workspace, ".env.staging.enc"))).toBe(false)
	}, TIMEOUT)

	test("deleting a non-existent environment exits with code 1", () => {
		const result = runCli(aliceHome, workspace, [
			"env", "delete", "nonexistent", "--yes",
		])
		expect(result.exitCode).toBe(1)
	}, TIMEOUT)
})

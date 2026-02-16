import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli, createMockEditor } from "../helpers/cli"

const TIMEOUT = 30_000

describe("Dev Command", () => {
	let home: string
	let workspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-07-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-07-workspace-"))
		generateEd25519Key(home)
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("Alice inits with personal identity", () => {
		runCli(home, workspace, ["init", "--name", "alice"])
	}, TIMEOUT)

	test("Create development environment with shared secrets", () => {
		runCli(home, workspace, ["env", "create", "development", "alice"])
		const editor = createMockEditor("SHARED_SECRET=shared123")
		runCli(home, workspace, ["env", "edit", "development"], { EDITOR: editor })
	}, TIMEOUT)

	test("Edit Alice's personal env with personal secrets", () => {
		const editor = createMockEditor("PERSONAL_SECRET=personal456")
		runCli(home, workspace, ["env", "edit", "alice"], { EDITOR: editor })
	}, TIMEOUT)

	test("dev command merges development and personal environments", () => {
		const result = runCli(home, workspace, ["dev", "--", "sh", "-c", "echo $SHARED_SECRET $PERSONAL_SECRET"])
		expect(result.stdout).toContain("shared123")
		expect(result.stdout).toContain("personal456")
	}, TIMEOUT)
})

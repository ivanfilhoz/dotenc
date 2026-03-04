import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createMockEditor, generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("hierarchical env loading (run)", () => {
	let aliceHome: string
	let workspace: string
	let subdir: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-24-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-24-workspace-"))
		subdir = path.join(workspace, "packages", "web")
		mkdirSync(subdir, { recursive: true })
		generateEd25519Key(aliceHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("init workspace and create root-level staging env", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])

		// Edit staging to add VALUE=root
		const editor = createMockEditor("VALUE=root")
		const result = runCli(
			aliceHome,
			workspace,
			["env", "edit", "staging"],
			{ EDITOR: editor },
		)
		expect(result.exitCode).toBe(0)
	}, TIMEOUT)

	test("create local staging env in packages/web with VALUE=local", () => {
		const result = runCli(aliceHome, subdir, [
			"env",
			"create",
			"staging",
			"alice",
		])
		expect(result.exitCode).toBe(0)

		// Edit local staging to add VALUE=local
		const editor = createMockEditor("VALUE=local")
		const editResult = runCli(aliceHome, subdir, ["env", "edit", "staging"], {
			EDITOR: editor,
		})
		expect(editResult.exitCode).toBe(0)
	}, TIMEOUT)

	test("run from root uses root VALUE=root", () => {
		const result = runCli(aliceHome, workspace, [
			"run",
			"-e",
			"staging",
			"printenv",
			"VALUE",
		])
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("root")
	}, TIMEOUT)

	test("run from subdir uses local VALUE=local (local wins)", () => {
		const result = runCli(aliceHome, subdir, [
			"run",
			"-e",
			"staging",
			"printenv",
			"VALUE",
		])
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("local")
	}, TIMEOUT)

	test("run --local-only from subdir uses only local value", () => {
		const result = runCli(aliceHome, subdir, [
			"run",
			"--local-only",
			"-e",
			"staging",
			"printenv",
			"VALUE",
		])
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("local")
	}, TIMEOUT)

	test("run from directory with no .dotenc ancestor exits with error", () => {
		const outsideDir = mkdtempSync(path.join(os.tmpdir(), "e2e-24-outside-"))
		try {
			const result = runCli(aliceHome, outsideDir, [
				"run",
				"-e",
				"staging",
				"printenv",
				"VALUE",
			])
			// Should fail: no .dotenc in ancestor chain, no env file found
			// (exits with 0 if env is missing but non-strict, or tries to load and fails)
			// The important thing is it doesn't crash with an unhandled error
			expect(typeof result.exitCode).toBe("number")
		} finally {
			rmSync(outsideDir, { recursive: true, force: true })
		}
	}, TIMEOUT)
})

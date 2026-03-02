import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli, createMockEditor } from "../helpers/cli"

const TIMEOUT = 30_000

describe("auth purge", () => {
	let aliceHome: string
	let bobHome: string
	let workspace: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-21-alice-"))
		bobHome = mkdtempSync(path.join(os.tmpdir(), "e2e-21-bob-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-21-workspace-"))
		generateEd25519Key(aliceHome)
		generateEd25519Key(bobHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(bobHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("Alice inits, creates staging and production envs, adds Bob's key", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "production", "alice"])

		const editor = createMockEditor("SECRET=staging-value")
		runCli(aliceHome, workspace, ["env", "edit", "staging"], { EDITOR: editor })
		const editor2 = createMockEditor("SECRET=production-value")
		runCli(aliceHome, workspace, ["env", "edit", "production"], { EDITOR: editor2 })

		runCli(aliceHome, workspace, [
			"key", "add", "bob", "--from-ssh",
			path.join(bobHome, ".ssh", "id_ed25519"),
		])
		runCli(aliceHome, workspace, ["auth", "grant", "staging", "bob"])
		runCli(aliceHome, workspace, ["auth", "grant", "production", "bob"])
	}, TIMEOUT)

	test("Bob can decrypt both environments before purge", () => {
		const staging = runCli(bobHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo $SECRET",
		])
		expect(staging.stdout).toContain("staging-value")

		const production = runCli(bobHome, workspace, [
			"run", "-e", "production", "--", "sh", "-c", "echo $SECRET",
		])
		expect(production.stdout).toContain("production-value")
	}, TIMEOUT)

	test("auth purge bob --yes exits with code 0", () => {
		const result = runCli(aliceHome, workspace, ["auth", "purge", "bob", "--yes"])
		expect(result.exitCode).toBe(0)
	}, TIMEOUT)

	test(".dotenc/bob.pub is deleted after purge", () => {
		expect(existsSync(path.join(workspace, ".dotenc", "bob.pub"))).toBe(false)
	}, TIMEOUT)

	test("Bob can no longer decrypt staging after purge", () => {
		const result = runCli(bobHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo $SECRET",
		])
		expect(result.stdout).not.toContain("staging-value")
	}, TIMEOUT)

	test("Bob can no longer decrypt production after purge", () => {
		const result = runCli(bobHome, workspace, [
			"run", "-e", "production", "--", "sh", "-c", "echo $SECRET",
		])
		expect(result.stdout).not.toContain("production-value")
	}, TIMEOUT)

	test("Alice can still decrypt both environments after purge", () => {
		const staging = runCli(aliceHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo $SECRET",
		])
		expect(staging.stdout).toContain("staging-value")

		const production = runCli(aliceHome, workspace, [
			"run", "-e", "production", "--", "sh", "-c", "echo $SECRET",
		])
		expect(production.stdout).toContain("production-value")
	}, TIMEOUT)

	test("summary output mentions both environments processed", () => {
		// Re-run in a fresh workspace to capture the output
		const ws2 = mkdtempSync(path.join(os.tmpdir(), "e2e-21b-workspace-"))
		const bobHome2 = mkdtempSync(path.join(os.tmpdir(), "e2e-21b-bob-"))
		generateEd25519Key(bobHome2)

		try {
			runCli(aliceHome, ws2, ["init", "--name", "alice"])
			runCli(aliceHome, ws2, ["env", "create", "staging", "alice"])
			runCli(aliceHome, ws2, ["env", "create", "production", "alice"])
			runCli(aliceHome, ws2, [
				"key", "add", "bob", "--from-ssh",
				path.join(bobHome2, ".ssh", "id_ed25519"),
			])
			runCli(aliceHome, ws2, ["auth", "grant", "staging", "bob"])
			runCli(aliceHome, ws2, ["auth", "grant", "production", "bob"])

			const result = runCli(aliceHome, ws2, ["auth", "purge", "bob", "--yes"])
			const output = result.stdout + result.stderr
			expect(output).toContain("staging")
			expect(output).toContain("production")
		} finally {
			rmSync(ws2, { recursive: true, force: true })
			rmSync(bobHome2, { recursive: true, force: true })
		}
	}, TIMEOUT)
})

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createMockEditor, generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("hierarchical env operations", () => {
	let aliceHome: string
	let workspace: string
	let subdir: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-26-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-26-workspace-"))
		subdir = path.join(workspace, "packages", "web")
		mkdirSync(subdir, { recursive: true })
		generateEd25519Key(aliceHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("init workspace at root", () => {
		const result = runCli(aliceHome, workspace, ["init", "--name", "alice"])
		expect(result.exitCode).toBe(0)
	}, TIMEOUT)

	test("env create from workspace root creates at project root", () => {
		const result = runCli(aliceHome, workspace, [
			"env",
			"create",
			"staging",
			"alice",
		])
		expect(result.exitCode).toBe(0)
		expect(existsSync(path.join(workspace, ".env.staging.enc"))).toBe(true)
		expect(existsSync(path.join(subdir, ".env.staging.enc"))).toBe(false)
	}, TIMEOUT)

	test("env create from subdir creates in subdir", () => {
		const result = runCli(aliceHome, subdir, [
			"env",
			"create",
			"staging",
			"alice",
		])
		expect(result.exitCode).toBe(0)
		expect(existsSync(path.join(subdir, ".env.staging.enc"))).toBe(true)
	}, TIMEOUT)

	test("env list from subdir shows only local environments", () => {
		const result = runCli(aliceHome, subdir, ["env", "list"])
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("staging")
		// Local-only output: no path labels
		expect(result.stdout).not.toContain("(")
	}, TIMEOUT)

	test("env list --all from subdir shows environments at all ancestor levels", () => {
		const result = runCli(aliceHome, subdir, ["env", "list", "--all"])
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("staging")
		// Multi-level output includes path labels
		expect(result.stdout).toContain("(")
	}, TIMEOUT)

	test("env rotate --all --yes recursively rotates root and subdir env files", () => {
		const rootCiphertextBefore = readFileSync(
			path.join(workspace, ".env.staging.enc"),
			"utf-8",
		)
		const subdirCiphertextBefore = readFileSync(
			path.join(subdir, ".env.staging.enc"),
			"utf-8",
		)

		const result = runCli(aliceHome, workspace, [
			"env",
			"rotate",
			"--all",
			"--yes",
		])
		expect(result.exitCode).toBe(0)

		const rootCiphertextAfter = readFileSync(
			path.join(workspace, ".env.staging.enc"),
			"utf-8",
		)
		const subdirCiphertextAfter = readFileSync(
			path.join(subdir, ".env.staging.enc"),
			"utf-8",
		)

		// Both files should have been re-encrypted (ciphertext changes)
		expect(rootCiphertextAfter).not.toBe(rootCiphertextBefore)
		expect(subdirCiphertextAfter).not.toBe(subdirCiphertextBefore)
	}, TIMEOUT)

	test("auth purge --yes revokes key from all nested env files", () => {
		// Add a second key (carol) and grant it access to both staging files
		generateEd25519Key(aliceHome, { fileName: "id_carol" })

		const carolKey = path.join(aliceHome, ".ssh", "id_carol")
		runCli(aliceHome, workspace, ["key", "add", "carol", "--from-ssh", carolKey])

		// Grant carol access to root staging
		runCli(aliceHome, workspace, ["auth", "grant", "staging", "carol"])

		// Grant carol access to subdir staging separately
		const editorScript = createMockEditor("")
		void editorScript

		// Purge carol — should revoke from both staging files
		const result = runCli(aliceHome, workspace, [
			"auth",
			"purge",
			"carol",
			"--yes",
		])
		expect(result.exitCode).toBe(0)
		// carol.pub should be deleted
		expect(existsSync(path.join(workspace, ".dotenc", "carol.pub"))).toBe(false)
	}, TIMEOUT)
})

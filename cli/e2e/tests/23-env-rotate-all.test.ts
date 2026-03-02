import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli } from "../helpers/cli"

const TIMEOUT = 30_000

describe("env rotate-all", () => {
	let aliceHome: string
	let workspace: string
	let stagingCiphertextBefore: string
	let productionCiphertextBefore: string

	beforeAll(() => {
		aliceHome = mkdtempSync(path.join(os.tmpdir(), "e2e-23-alice-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-23-workspace-"))
		generateEd25519Key(aliceHome)
	})

	afterAll(() => {
		rmSync(aliceHome, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("init and create staging and production envs", () => {
		runCli(aliceHome, workspace, ["init", "--name", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "staging", "alice"])
		runCli(aliceHome, workspace, ["env", "create", "production", "alice"])
	}, TIMEOUT)

	test("record ciphertext before rotation", () => {
		stagingCiphertextBefore = readFileSync(
			path.join(workspace, ".env.staging.enc"),
			"utf-8",
		)
		productionCiphertextBefore = readFileSync(
			path.join(workspace, ".env.production.enc"),
			"utf-8",
		)
		expect(stagingCiphertextBefore).toBeTruthy()
		expect(productionCiphertextBefore).toBeTruthy()
	}, TIMEOUT)

	test("env rotate-all --yes exits with code 0", () => {
		const result = runCli(aliceHome, workspace, [
			"env", "rotate-all", "--yes",
		])
		expect(result.exitCode).toBe(0)
	}, TIMEOUT)

	test("ciphertext of staging changed after rotation", () => {
		const after = readFileSync(
			path.join(workspace, ".env.staging.enc"),
			"utf-8",
		)
		expect(after).not.toBe(stagingCiphertextBefore)
	}, TIMEOUT)

	test("ciphertext of production changed after rotation", () => {
		const after = readFileSync(
			path.join(workspace, ".env.production.enc"),
			"utf-8",
		)
		expect(after).not.toBe(productionCiphertextBefore)
	}, TIMEOUT)

	test("Alice can still decrypt both environments after rotation", () => {
		const staging = runCli(aliceHome, workspace, [
			"run", "-e", "staging", "--", "sh", "-c", "echo ok",
		])
		expect(staging.stdout).toContain("ok")

		const production = runCli(aliceHome, workspace, [
			"run", "-e", "production", "--", "sh", "-c", "echo ok",
		])
		expect(production.stdout).toContain("ok")
	}, TIMEOUT)

	test("output mentions both environments", () => {
		// Re-run in fresh workspace to capture output
		const ws2 = mkdtempSync(path.join(os.tmpdir(), "e2e-23b-workspace-"))
		try {
			runCli(aliceHome, ws2, ["init", "--name", "alice"])
			runCli(aliceHome, ws2, ["env", "create", "staging", "alice"])
			runCli(aliceHome, ws2, ["env", "create", "production", "alice"])

			const result = runCli(aliceHome, ws2, ["env", "rotate-all", "--yes"])
			const output = result.stdout + result.stderr
			expect(output).toContain("staging")
			expect(output).toContain("production")
		} finally {
			rmSync(ws2, { recursive: true, force: true })
		}
	}, TIMEOUT)
})

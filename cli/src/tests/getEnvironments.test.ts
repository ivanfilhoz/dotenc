import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getEnvironments } from "../helpers/getEnvironments"

describe("getEnvironments", () => {
	let tmpDir: string
	const originalCwd = process.cwd()

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-getenvs-"))
		writeFileSync(path.join(tmpDir, ".env.development.enc"), "{}", "utf-8")
		writeFileSync(path.join(tmpDir, ".env.production.enc"), "{}", "utf-8")
		writeFileSync(path.join(tmpDir, ".env.alice.enc"), "{}", "utf-8")
		// Not an env file — should be excluded
		writeFileSync(path.join(tmpDir, "dotenc.json"), "{}", "utf-8")
		writeFileSync(path.join(tmpDir, ".env"), "", "utf-8")
		process.chdir(tmpDir)
	})

	afterAll(() => {
		process.chdir(originalCwd)
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("returns environment names from .env.*.enc files", async () => {
		const envs = await getEnvironments()
		expect(envs).toContain("development")
		expect(envs).toContain("production")
		expect(envs).toContain("alice")
		expect(envs).toHaveLength(3)
	})
})

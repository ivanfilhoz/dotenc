import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { environmentExists } from "../helpers/environmentExists"

describe("environmentExists", () => {
	let tmpDir: string
	const originalCwd = process.cwd()

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-envexists-"))
		writeFileSync(path.join(tmpDir, ".env.staging.enc"), "{}", "utf-8")
		process.chdir(tmpDir)
	})

	afterAll(() => {
		process.chdir(originalCwd)
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("returns true when environment file exists", () => {
		expect(environmentExists("staging")).toBe(true)
	})

	test("returns false when environment file does not exist", () => {
		expect(environmentExists("production")).toBe(false)
	})
})

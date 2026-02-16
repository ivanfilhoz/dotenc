import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getEnvironmentNameSuggestion } from "../helpers/getEnvironmentNameSuggestion"

describe("getEnvironmentNameSuggestion", () => {
	let tmpDir: string
	const originalCwd = process.cwd()

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-envsuggest-"))
		process.chdir(tmpDir)
	})

	afterAll(() => {
		process.chdir(originalCwd)
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("suggests 'development' when no environments exist", () => {
		expect(getEnvironmentNameSuggestion()).toBe("development")
	})

	test("suggests the next available name", () => {
		writeFileSync(path.join(tmpDir, ".env.development.enc"), "{}", "utf-8")
		expect(getEnvironmentNameSuggestion()).toBe("staging")

		writeFileSync(path.join(tmpDir, ".env.staging.enc"), "{}", "utf-8")
		expect(getEnvironmentNameSuggestion()).toBe("production")

		writeFileSync(path.join(tmpDir, ".env.production.enc"), "{}", "utf-8")
		expect(getEnvironmentNameSuggestion()).toBe("test")
	})

	test("returns empty string when all suggestions exist", () => {
		writeFileSync(path.join(tmpDir, ".env.test.enc"), "{}", "utf-8")
		expect(getEnvironmentNameSuggestion()).toBe("")
	})
})

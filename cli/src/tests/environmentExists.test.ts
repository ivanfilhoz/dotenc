import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { environmentExists } from "../helpers/environmentExists"

describe("environmentExists", () => {
	let tmpDir: string
	let cwdSpy: ReturnType<typeof spyOn>

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-envexists-"))
		writeFileSync(path.join(tmpDir, ".env.staging.enc"), "{}", "utf-8")
		cwdSpy = spyOn(process, "cwd").mockReturnValue(tmpDir)
	})

	afterAll(() => {
		cwdSpy.mockRestore()
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("returns true when environment file exists", () => {
		expect(environmentExists("staging")).toBe(true)
	})

	test("returns false when environment file does not exist", () => {
		expect(environmentExists("production")).toBe(false)
	})
})

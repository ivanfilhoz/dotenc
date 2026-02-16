import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

describe("projectConfig", () => {
	let tmpDir: string
	const originalCwd = process.cwd()

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-projectconfig-"))
		process.chdir(tmpDir)
	})

	afterAll(() => {
		process.chdir(originalCwd)
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("getProjectConfig returns empty object when no config exists", async () => {
		const { getProjectConfig } = await import("../helpers/projectConfig")
		const config = await getProjectConfig()
		expect(config).toEqual({})
	})

	test("setProjectConfig writes config file", async () => {
		const { setProjectConfig } = await import("../helpers/projectConfig")
		await setProjectConfig({ projectId: "test-id-123" })

		const raw = readFileSync(path.join(tmpDir, "dotenc.json"), "utf-8")
		const parsed = JSON.parse(raw)
		expect(parsed.projectId).toBe("test-id-123")
	})

	test("getProjectConfig reads existing config", async () => {
		const { getProjectConfig } = await import("../helpers/projectConfig")
		const config = await getProjectConfig()
		expect(config.projectId).toBe("test-id-123")
	})
})

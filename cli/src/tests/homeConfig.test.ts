import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getHomeConfig, setHomeConfig } from "../helpers/homeConfig"

describe("homeConfig", () => {
	let tmpHome: string
	let homeSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		tmpHome = mkdtempSync(path.join(os.tmpdir(), "test-homeconfig-"))
		mkdirSync(path.join(tmpHome, ".dotenc"), { recursive: true })
		homeSpy = spyOn(os, "homedir").mockReturnValue(tmpHome)
	})

	afterEach(() => {
		homeSpy.mockRestore()
		rmSync(tmpHome, { recursive: true, force: true })
	})

	test("getHomeConfig returns empty object when no config exists", async () => {
		const result = await getHomeConfig()
		expect(result).toEqual({})
	})

	test("setHomeConfig writes and getHomeConfig reads config", async () => {
		await setHomeConfig({ editor: "vim" })
		const result = await getHomeConfig()
		expect(result.editor).toBe("vim")
	})

	test("setHomeConfig overwrites existing config", async () => {
		await setHomeConfig({ editor: "vim" })
		await setHomeConfig({ editor: "code" })
		const result = await getHomeConfig()
		expect(result.editor).toBe("code")
	})

	test("rejects invalid config schema on set", async () => {
		await expect(
			setHomeConfig({ editor: 123 as unknown as string }),
		).rejects.toThrow()
	})

	test("rejects invalid config schema on get", async () => {
		const configPath = path.join(tmpHome, ".dotenc", "config.json")
		writeFileSync(configPath, JSON.stringify({ editor: 123 }), "utf-8")

		await expect(getHomeConfig()).rejects.toThrow()
	})
})

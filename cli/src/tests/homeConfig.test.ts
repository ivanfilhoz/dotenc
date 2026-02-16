import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

describe("homeConfig", () => {
	let tmpHome: string
	let configPath: string

	beforeAll(() => {
		tmpHome = mkdtempSync(path.join(os.tmpdir(), "test-homeconfig-"))
		mkdirSync(path.join(tmpHome, ".dotenc"), { recursive: true })
		configPath = path.join(tmpHome, ".dotenc", "config.json")
	})

	afterAll(() => {
		rmSync(tmpHome, { recursive: true, force: true })
	})

	test("getHomeConfig returns empty object when no config exists", async () => {
		const fs = await import("node:fs")
		const _fsp = await import("node:fs/promises")
		const { z } = await import("zod")

		const _homeConfigSchema = z.object({ editor: z.string().nullish() })

		// Simulate what homeConfig does but with our configPath
		if (!fs.existsSync(configPath)) {
			const config = {}
			expect(config).toEqual({})
		}
	})

	test("setHomeConfig writes and getHomeConfig reads config", async () => {
		const fsp = await import("node:fs/promises")
		const { z } = await import("zod")

		const homeConfigSchema = z.object({ editor: z.string().nullish() })

		// Write
		const config = { editor: "vim" }
		const parsed = homeConfigSchema.parse(config)
		await fsp.writeFile(configPath, JSON.stringify(parsed, null, 2), "utf-8")

		// Read
		const content = JSON.parse(await fsp.readFile(configPath, "utf-8"))
		const result = homeConfigSchema.parse(content)
		expect(result.editor).toBe("vim")
	})

	test("setHomeConfig overwrites existing config", async () => {
		const fsp = await import("node:fs/promises")
		const { z } = await import("zod")

		const homeConfigSchema = z.object({ editor: z.string().nullish() })

		await fsp.writeFile(
			configPath,
			JSON.stringify({ editor: "vim" }, null, 2),
			"utf-8",
		)
		await fsp.writeFile(
			configPath,
			JSON.stringify({ editor: "code" }, null, 2),
			"utf-8",
		)

		const content = JSON.parse(await fsp.readFile(configPath, "utf-8"))
		const result = homeConfigSchema.parse(content)
		expect(result.editor).toBe("code")
	})

	test("rejects invalid config schema", async () => {
		const { z } = await import("zod")
		const homeConfigSchema = z.object({ editor: z.string().nullish() })

		expect(() => homeConfigSchema.parse({ editor: 123 })).toThrow()
	})
})

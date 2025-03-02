import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { z } from "zod"

const homeConfigSchema = z.object({
	editor: z.string().nullish(),
})

type HomeConfig = z.infer<typeof homeConfigSchema>

const configPath = path.join(os.homedir(), ".dotenc", "config.json")

export const setHomeConfig = async (config: HomeConfig) => {
	const parsedConfig = homeConfigSchema.parse(config)
	await fs.writeFile(configPath, JSON.stringify(parsedConfig, null, 2), {
		mode: 0o600,
	})
	console.debug("config.json saved")
}

export const getHomeConfig = async () => {
	if (existsSync(configPath)) {
		const config = JSON.parse(await fs.readFile(configPath, "utf-8"))
		return homeConfigSchema.parse(config)
	}

	return {} as HomeConfig
}

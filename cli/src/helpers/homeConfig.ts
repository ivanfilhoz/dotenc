import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { z } from "zod"

const homeConfigSchema = z.object({
	editor: z.string().nullish(),
})

type HomeConfig = z.infer<typeof homeConfigSchema>

const getConfigPath = () => path.join(os.homedir(), ".dotenc", "config.json")

export const setHomeConfig = async (config: HomeConfig) => {
	const parsedConfig = homeConfigSchema.parse(config)
	const configPath = getConfigPath()
	await fs.writeFile(configPath, JSON.stringify(parsedConfig, null, 2), "utf-8")
}

export const getHomeConfig = async () => {
	const configPath = getConfigPath()
	if (existsSync(configPath)) {
		const config = JSON.parse(await fs.readFile(configPath, "utf-8"))
		return homeConfigSchema.parse(config)
	}

	return {} as HomeConfig
}

import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

const projectConfigSchema = z.object({
	projectId: z.string(),
})

type ProjectConfig = z.infer<typeof projectConfigSchema>

const configPath = path.join(process.cwd(), "dotenc.json")

export const setProjectConfig = async (config: ProjectConfig) => {
	const parsedConfig = projectConfigSchema.parse(config)
	await fs.writeFile(configPath, JSON.stringify(parsedConfig, null, 2), "utf-8")
}

export const getProjectConfig = async () => {
	if (existsSync(configPath)) {
		const config = JSON.parse(await fs.readFile(configPath, "utf-8"))
		return projectConfigSchema.parse(config)
	}

	return {} as ProjectConfig
}

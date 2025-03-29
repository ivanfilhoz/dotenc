import { existsSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getProjectConfig } from "../../helpers/projectConfig"

export const cleanupProjectKeys = async () => {
	const { projectId } = await getProjectConfig()
	const keysFile = path.join(os.homedir(), ".dotenc", "keys.json")
	if (existsSync(keysFile)) {
		const keys = JSON.parse(readFileSync(keysFile, "utf-8"))
		delete keys[projectId]
		writeFileSync(keysFile, JSON.stringify(keys, null, 2))
	}
}

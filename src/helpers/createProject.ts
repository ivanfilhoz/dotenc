import { createId } from "@paralleldrive/cuid2"
import { getProjectConfig, setProjectConfig } from "./projectConfig"

export const createProject = async () => {
	const config = await getProjectConfig()

	if (config.projectId) {
		return config
	}

	const newConfig = {
		projectId: createId(),
	}

	await setProjectConfig(newConfig)

	return newConfig
}

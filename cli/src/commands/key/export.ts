import { getKey } from "../../helpers/key"
import { getProjectConfig } from "../../helpers/projectConfig"

export const keyExportCommand = async (environmentArg: string) => {
	const environment = environmentArg
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	const key = await getKey(environment)
	console.log(`Key for the ${environment} environment: ${key}`)
}

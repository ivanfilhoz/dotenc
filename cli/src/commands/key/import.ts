import { addKey } from "../../helpers/key"
import { getProjectConfig } from "../../helpers/projectConfig"

export const keyImportCommand = async (key: string, environmentArg: string) => {
	const environment = environmentArg
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	await addKey(projectId, environment, key)
	console.log(`Key imported to the ${environment} environment.`)
}

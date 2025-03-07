import { getProjectConfig } from "../../helpers/projectConfig"
import { getToken } from "../../helpers/token"

export const tokenExportCommand = async (environmentArg: string) => {
	const environment = environmentArg
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	const token = await getToken(environment)
	console.log(`Token for the ${environment} environment: ${token}`)
}

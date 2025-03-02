import { getProjectConfig } from "../../helpers/projectConfig"
import { getToken } from "../../helpers/token"

export const tokenExportCommand = async (environmentArg: string) => {
	const environment = environmentArg
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		throw new Error('No project found. Run "dotenc init" to create one.')
	}

	const token = await getToken(environment)
	console.log(`Token for the ${environment} environment: ${token}`)
}

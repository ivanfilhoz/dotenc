import { getProjectConfig } from "../../helpers/projectConfig"
import { addToken } from "../../helpers/token"

export const tokenImportCommand = async (
	token: string,
	environmentArg: string,
) => {
	const environment = environmentArg
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		console.error('No project found. Run "dotenc init" to create one.')
		return
	}

	await addToken(projectId, environment, token)
	console.log(`Token imported to the ${environment} environment.`)
}

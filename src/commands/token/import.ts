import { getProjectConfig } from "../../helpers/projectConfig"
import { addToken } from "../../helpers/token"

export const tokenImportCommand = async (
	token: string,
	environmentArg: string,
) => {
	const environment = environmentArg
	const { projectId } = await getProjectConfig()

	if (!projectId) {
		throw new Error('No project found. Run "npx safe-env init" to create one.')
	}

	await addToken(projectId, environment, token)
	console.log(`Token imported to the ${environment} environment.`)
}

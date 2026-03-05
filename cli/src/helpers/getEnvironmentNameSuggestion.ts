import { existsSync } from "node:fs"
import path from "node:path"

export const getEnvironmentNameSuggestion = () => {
	const suggestions =
		["development", "staging", "production", "test"].find(
			(env) => !existsSync(path.join(process.cwd(), `.env.${env}.enc`)),
		) ?? ""
	return suggestions
}

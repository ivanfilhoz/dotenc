import { environmentExists } from "./environmentExists"

export const getEnvironmentNameSuggestion = () => {
	const suggestions =
		["development", "staging", "production", "test"].find(
			(env) => !environmentExists(env),
		) ?? ""
	return suggestions
}

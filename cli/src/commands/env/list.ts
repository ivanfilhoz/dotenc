import { getEnvironments } from "../../helpers/getEnvironments"

export const envListCommand = async () => {
	const environments = await getEnvironments()

	if (!environments.length) {
		console.log("No environments found.")
		return
	}

	for (const name of environments) {
		console.log(name)
	}
}

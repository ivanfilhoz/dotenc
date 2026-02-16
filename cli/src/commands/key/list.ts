import { getPublicKeys } from "../../helpers/getPublicKeys"

export const keyListCommand = async () => {
	const publicKeys = await getPublicKeys()

	if (!publicKeys.length) {
		console.log("No public keys found.")
		return
	}

	for (const key of publicKeys) {
		console.log(`${key.name} (${key.algorithm})`)
	}
}

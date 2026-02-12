import { getPrivateKeys, type PrivateKeyEntry } from "./getPrivateKeys"

export const getPrivateKeyByName = async (
	name: string,
): Promise<PrivateKeyEntry> => {
	const privateKeys = await getPrivateKeys()
	const entry = privateKeys.find((k) => k.name === name)

	if (!entry) {
		throw new Error(
			`No SSH private key found with name ${name}. Available keys: ${privateKeys.map((k) => k.name).join(", ") || "none"}`,
		)
	}

	return entry
}

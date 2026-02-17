import { getPrivateKeys, type PrivateKeyEntry } from "./getPrivateKeys"

type GetPrivateKeyByNameDeps = {
	getPrivateKeys: typeof getPrivateKeys
}

export const getPrivateKeyByName = async (
	name: string,
	deps: GetPrivateKeyByNameDeps = { getPrivateKeys },
): Promise<PrivateKeyEntry> => {
	const { keys: privateKeys } = await deps.getPrivateKeys()
	const entry = privateKeys.find((k) => k.name === name)

	if (!entry) {
		throw new Error(
			`No SSH private key found with name ${name}. Available keys: ${privateKeys.map((k) => k.name).join(", ") || "none"}`,
		)
	}

	return entry
}

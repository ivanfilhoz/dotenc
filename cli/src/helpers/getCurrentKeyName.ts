import { getPrivateKeys } from "./getPrivateKeys"
import { getPublicKeys } from "./getPublicKeys"

type GetCurrentKeyNameDeps = {
	getPrivateKeys: typeof getPrivateKeys
	getPublicKeys: typeof getPublicKeys
}

export const getCurrentKeyName = async (
	deps: GetCurrentKeyNameDeps = { getPrivateKeys, getPublicKeys },
): Promise<string[]> => {
	const { keys: privateKeys } = await deps.getPrivateKeys()
	const publicKeys = await deps.getPublicKeys()

	const privateFingerprints = new Set(privateKeys.map((k) => k.fingerprint))

	const matches = publicKeys.filter((pub) =>
		privateFingerprints.has(pub.fingerprint),
	)

	return matches.map((m) => m.name)
}

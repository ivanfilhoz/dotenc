import { getPrivateKeys } from "./getPrivateKeys"
import { getPublicKeys } from "./getPublicKeys"

type GetCurrentKeyNameDeps = {
	getPrivateKeys: typeof getPrivateKeys
	getPublicKeys: typeof getPublicKeys
}

export const getCurrentKeyName = async (
	deps: GetCurrentKeyNameDeps = { getPrivateKeys, getPublicKeys },
): Promise<string | undefined> => {
	const { keys: privateKeys } = await deps.getPrivateKeys()
	const publicKeys = await deps.getPublicKeys()

	const privateFingerprints = new Set(privateKeys.map((k) => k.fingerprint))

	const match = publicKeys.find((pub) =>
		privateFingerprints.has(pub.fingerprint),
	)

	return match?.name
}

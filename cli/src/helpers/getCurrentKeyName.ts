import { getPrivateKeys } from "./getPrivateKeys"
import { getPublicKeys } from "./getPublicKeys"

export const getCurrentKeyName = async (): Promise<string | undefined> => {
	const { keys: privateKeys } = await getPrivateKeys()
	const publicKeys = await getPublicKeys()

	const privateFingerprints = new Set(privateKeys.map((k) => k.fingerprint))

	const match = publicKeys.find((pub) =>
		privateFingerprints.has(pub.fingerprint),
	)

	return match?.name
}

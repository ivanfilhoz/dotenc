import { passphraseProtectedKeyError } from "../helpers/errors"
import { getEnvironmentByName } from "../helpers/getEnvironmentByName"
import { getEnvironments } from "../helpers/getEnvironments"
import { getPrivateKeys } from "../helpers/getPrivateKeys"
import { getPublicKeys } from "../helpers/getPublicKeys"

export const whoamiCommand = async () => {
	const { keys: privateKeys, passphraseProtectedKeys } = await getPrivateKeys()
	const publicKeys = await getPublicKeys()

	const privateFingerprints = new Set(privateKeys.map((k) => k.fingerprint))

	const matchingPublicKey = publicKeys.find((pub) =>
		privateFingerprints.has(pub.fingerprint),
	)

	if (!matchingPublicKey) {
		if (privateKeys.length === 0 && passphraseProtectedKeys.length > 0) {
			console.error(passphraseProtectedKeyError(passphraseProtectedKeys))
		} else {
			console.error(
				'No matching key found in this project. Run "dotenc init" to set up your identity.',
			)
		}
		process.exit(1)
	}

	const matchingPrivateKey = privateKeys.find(
		(pk) => pk.fingerprint === matchingPublicKey.fingerprint,
	)

	console.log(`Name: ${matchingPublicKey.name}`)
	console.log(`Active SSH key: ${matchingPrivateKey?.name ?? "unknown"}`)
	console.log(`Fingerprint: ${matchingPublicKey.fingerprint}`)

	const environments = await getEnvironments()
	const authorizedEnvironments: string[] = []

	for (const envName of environments) {
		try {
			const environment = await getEnvironmentByName(envName)
			const hasAccess = environment.keys.some(
				(key) => key.fingerprint === matchingPublicKey.fingerprint,
			)
			if (hasAccess) {
				authorizedEnvironments.push(envName)
			}
		} catch {
			// Skip environments that can't be read
		}
	}

	if (authorizedEnvironments.length > 0) {
		console.log("Authorized environments:")
		for (const env of authorizedEnvironments) {
			console.log(`  - ${env}`)
		}
	} else {
		console.log("Authorized environments: none")
	}
}

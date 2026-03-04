import { existsSync } from "node:fs"
import path from "node:path"
import { passphraseProtectedKeyError } from "../helpers/errors"
import { findEnvironmentsRecursive } from "../helpers/findEnvironmentsRecursive"
import { getEnvironmentByPath } from "../helpers/getEnvironmentByPath"
import { getPrivateKeys } from "../helpers/getPrivateKeys"
import { getPublicKeys } from "../helpers/getPublicKeys"
import { resolveProjectRoot } from "../helpers/resolveProjectRoot"

export type WhoamiCommandDeps = {
	getPrivateKeys: typeof getPrivateKeys
	getPublicKeys: typeof getPublicKeys
	findEnvironmentsRecursive: typeof findEnvironmentsRecursive
	getEnvironmentByPath: typeof getEnvironmentByPath
	resolveProjectRoot: typeof resolveProjectRoot
	existsSync: typeof existsSync
	cwd: () => string
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const defaultWhoamiCommandDeps: WhoamiCommandDeps = {
	getPrivateKeys,
	getPublicKeys,
	findEnvironmentsRecursive,
	getEnvironmentByPath,
	resolveProjectRoot,
	existsSync,
	cwd: () => process.cwd(),
	log: (message) => console.log(message),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

export const whoamiCommand = async (
	depsOverrides: Partial<WhoamiCommandDeps> = {},
) => {
	const deps: WhoamiCommandDeps = {
		...defaultWhoamiCommandDeps,
		...depsOverrides,
	}

	let projectRoot: string
	try {
		projectRoot = deps.resolveProjectRoot(deps.cwd(), deps.existsSync)
	} catch {
		projectRoot = deps.cwd()
	}
	const dotencDir = path.join(projectRoot, ".dotenc")

	const { keys: privateKeys, passphraseProtectedKeys } =
		await deps.getPrivateKeys()
	const publicKeys = await deps.getPublicKeys(dotencDir)

	const privateFingerprints = new Set(privateKeys.map((k) => k.fingerprint))

	const matchingPublicKeys = publicKeys.filter((pub) =>
		privateFingerprints.has(pub.fingerprint),
	)

	if (matchingPublicKeys.length === 0) {
		if (privateKeys.length === 0 && passphraseProtectedKeys.length > 0) {
			deps.logError(passphraseProtectedKeyError(passphraseProtectedKeys))
		} else {
			deps.logError(
				'No matching key found in this project. Run "dotenc init" to set up your identity.',
			)
		}
		deps.exit(1)
	}

	const envFiles = await deps.findEnvironmentsRecursive(projectRoot)

	for (let i = 0; i < matchingPublicKeys.length; i++) {
		const matchingPublicKey = matchingPublicKeys[i]

		if (i > 0) {
			deps.log("")
		}

		const matchingPrivateKey = privateKeys.find(
			(pk) => pk.fingerprint === matchingPublicKey.fingerprint,
		)

		deps.log(`Name: ${matchingPublicKey.name}`)
		deps.log(`Active SSH key: ${matchingPrivateKey?.name ?? "unknown"}`)
		deps.log(`Fingerprint: ${matchingPublicKey.fingerprint}`)

		const authorizedEnvironments: string[] = []

		for (const envFile of envFiles) {
			try {
				const environment = await deps.getEnvironmentByPath(envFile.filePath)
				const hasAccess = environment.keys.some(
					(key) => key.fingerprint === matchingPublicKey.fingerprint,
				)
				if (hasAccess) {
					const rel = path.relative(projectRoot, envFile.dir)
					authorizedEnvironments.push(
						rel ? `${envFile.name} (${rel})` : envFile.name,
					)
				}
			} catch {
				// Skip environments that can't be read
			}
		}

		if (authorizedEnvironments.length > 0) {
			deps.log("Authorized environments:")
			for (const env of authorizedEnvironments) {
				deps.log(`  - ${env}`)
			}
		} else {
			deps.log("Authorized environments: none")
		}
	}
}

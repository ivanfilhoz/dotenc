import { existsSync } from "node:fs"
import path from "node:path"
import { getPublicKeys } from "../../helpers/getPublicKeys"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"

export type KeyListCommandDeps = {
	getPublicKeys: typeof getPublicKeys
	resolveProjectRoot: typeof resolveProjectRoot
	existsSync: typeof existsSync
	cwd: () => string
	log: (message: string) => void
}

const defaultKeyListCommandDeps: KeyListCommandDeps = {
	getPublicKeys,
	resolveProjectRoot,
	existsSync,
	cwd: () => process.cwd(),
	log: (message) => console.log(message),
}

export const keyListCommand = async (
	depsOverrides: Partial<KeyListCommandDeps> = {},
) => {
	const deps: KeyListCommandDeps = {
		...defaultKeyListCommandDeps,
		...depsOverrides,
	}

	let projectRoot: string
	try {
		projectRoot = deps.resolveProjectRoot(deps.cwd(), deps.existsSync)
	} catch {
		projectRoot = deps.cwd()
	}
	const dotencDir = path.join(projectRoot, ".dotenc")

	const publicKeys = await deps.getPublicKeys(dotencDir)

	if (!publicKeys.length) {
		deps.log("No public keys found.")
		return
	}

	for (const key of publicKeys) {
		deps.log(`${key.name} (${key.algorithm})`)
	}
}

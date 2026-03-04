import { existsSync } from "node:fs"
import path from "node:path"
import { getPublicKeys } from "../../helpers/getPublicKeys"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"

export const keyListCommand = async () => {
	let projectRoot: string
	try {
		projectRoot = resolveProjectRoot(process.cwd(), existsSync)
	} catch {
		projectRoot = process.cwd()
	}
	const dotencDir = path.join(projectRoot, ".dotenc")

	const publicKeys = await getPublicKeys(dotencDir)

	if (!publicKeys.length) {
		console.log("No public keys found.")
		return
	}

	for (const key of publicKeys) {
		console.log(`${key.name} (${key.algorithm})`)
	}
}

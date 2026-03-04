import { existsSync } from "node:fs"
import path from "node:path"
import { findEnvironmentsRecursive } from "../../helpers/findEnvironmentsRecursive"
import { getEnvironments } from "../../helpers/getEnvironments"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"

type Options = {
	all?: boolean
	json?: boolean
}

type EnvEntry = { name: string; dir: string; filePath: string }

export const envListCommand = async (options: Options = {}) => {
	const invocationDir = process.cwd()
	let entries: EnvEntry[]
	let projectRoot: string | undefined

	if (options.all) {
		try {
			projectRoot = resolveProjectRoot(invocationDir, existsSync)
		} catch {
			projectRoot = invocationDir
		}
		const found = await findEnvironmentsRecursive(projectRoot)
		entries = found.map(({ name, dir, filePath }) => ({ name, dir, filePath }))
	} else {
		const names = await getEnvironments(invocationDir)
		entries = names.map((name) => ({
			name,
			dir: invocationDir,
			filePath: path.join(invocationDir, `.env.${name}.enc`),
		}))
	}

	if (options.json) {
		console.log(JSON.stringify({ environments: entries }))
		return
	}

	if (!entries.length) {
		console.log("No environments found.")
		return
	}

	for (const { name, dir } of entries) {
		if (options.all && projectRoot !== undefined) {
			const relPath = path.relative(projectRoot, dir) || "."
			console.log(`${name}  (${relPath})`)
		} else {
			console.log(name)
		}
	}
}

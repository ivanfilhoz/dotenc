import { existsSync } from "node:fs"
import path from "node:path"
import { findEnvironmentsRecursive } from "../../helpers/findEnvironmentsRecursive"
import { getEnvironments } from "../../helpers/getEnvironments"
import { resolveProjectRoot } from "../../helpers/resolveProjectRoot"

type Options = {
	all?: boolean
	json?: boolean
}

export type EnvListCommandDeps = {
	getEnvironments: typeof getEnvironments
	findEnvironmentsRecursive: typeof findEnvironmentsRecursive
	resolveProjectRoot: typeof resolveProjectRoot
	existsSync: typeof existsSync
	cwd: () => string
	log: (message: string) => void
}

const defaultEnvListCommandDeps: EnvListCommandDeps = {
	getEnvironments,
	findEnvironmentsRecursive,
	resolveProjectRoot,
	existsSync,
	cwd: () => process.cwd(),
	log: (message) => console.log(message),
}

type EnvEntry = { name: string; dir: string; filePath: string }

export const envListCommand = async (
	options: Options = {},
	depsOverrides: Partial<EnvListCommandDeps> = {},
) => {
	const deps: EnvListCommandDeps = {
		...defaultEnvListCommandDeps,
		...depsOverrides,
	}

	const invocationDir = deps.cwd()
	let entries: EnvEntry[]
	let projectRoot: string | undefined

	if (options.all) {
		try {
			projectRoot = deps.resolveProjectRoot(invocationDir, deps.existsSync)
		} catch {
			projectRoot = invocationDir
		}
		const found = await deps.findEnvironmentsRecursive(projectRoot)
		entries = found.map(({ name, dir, filePath }) => ({ name, dir, filePath }))
	} else {
		const names = await deps.getEnvironments(invocationDir)
		entries = names.map((name) => ({
			name,
			dir: invocationDir,
			filePath: path.join(invocationDir, `.env.${name}.enc`),
		}))
	}

	if (options.json) {
		deps.log(JSON.stringify({ environments: entries }))
		return
	}

	if (!entries.length) {
		deps.log("No environments found.")
		return
	}

	for (const { name, dir } of entries) {
		if (options.all && projectRoot !== undefined) {
			const relPath = path.relative(projectRoot, dir) || "."
			deps.log(`${name}  (${relPath})`)
		} else {
			deps.log(name)
		}
	}
}

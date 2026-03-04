import { spawnSync } from "node:child_process"
import { constants, existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

const PASSWORDLESS_SUFFIX = "_passwordless"

type ResolvePasswordlessSshKeyCopyPathDeps = {
	existsSync: typeof existsSync
}

const defaultResolvePathDeps: ResolvePasswordlessSshKeyCopyPathDeps = {
	existsSync,
}

export const _resolvePasswordlessSshKeyCopyPath = (
	sourcePath: string,
	deps: ResolvePasswordlessSshKeyCopyPathDeps = defaultResolvePathDeps,
) => {
	const directory = path.dirname(sourcePath)
	const sourceName = path.basename(sourcePath)
	const baseName = `${sourceName}${PASSWORDLESS_SUFFIX}`
	const basePath = path.join(directory, baseName)

	if (!deps.existsSync(basePath) && !deps.existsSync(`${basePath}.pub`)) {
		return basePath
	}

	for (let index = 1; index < 1000; index += 1) {
		const candidateName = `${baseName}_${index}`
		const candidatePath = path.join(directory, candidateName)
		if (
			!deps.existsSync(candidatePath) &&
			!deps.existsSync(`${candidatePath}.pub`)
		) {
			return candidatePath
		}
	}

	throw new Error(
		"Could not find an available name for the passwordless SSH key copy.",
	)
}

type CreatePasswordlessSshKeyCopyDeps = {
	copyFile: typeof fs.copyFile
	chmod: typeof fs.chmod
	unlink: typeof fs.unlink
	spawnSync: typeof spawnSync
	resolvePasswordlessSshKeyCopyPath: (
		sourcePath: string,
	) => ReturnType<typeof _resolvePasswordlessSshKeyCopyPath>
}

const defaultCreatePasswordlessSshKeyCopyDeps: CreatePasswordlessSshKeyCopyDeps =
	{
		copyFile: fs.copyFile,
		chmod: fs.chmod,
		unlink: fs.unlink,
		spawnSync,
		resolvePasswordlessSshKeyCopyPath: _resolvePasswordlessSshKeyCopyPath,
	}

export const createPasswordlessSshKeyCopy = async (
	sourcePath: string,
	deps: CreatePasswordlessSshKeyCopyDeps = defaultCreatePasswordlessSshKeyCopyDeps,
) => {
	const passwordlessPath = deps.resolvePasswordlessSshKeyCopyPath(sourcePath)

	try {
		await deps.copyFile(sourcePath, passwordlessPath, constants.COPYFILE_EXCL)
		await deps.chmod(passwordlessPath, 0o600)
	} catch (error) {
		throw new Error(
			`Failed to create passwordless key copy: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	// ssh-keygen prompts for the current passphrase and writes the copy unencrypted.
	const result = deps.spawnSync(
		"ssh-keygen",
		["-p", "-f", passwordlessPath, "-N", ""],
		{
			stdio: "inherit",
			encoding: "utf-8",
		},
	)

	if (result.error) {
		await deps.unlink(passwordlessPath).catch(() => {})
		if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				"Failed to run ssh-keygen: command not found. Please install OpenSSH and try again.",
			)
		}
		throw new Error(
			`Failed to run ssh-keygen: ${result.error.message || "unknown error"}`,
		)
	}

	if (typeof result.status === "number" && result.status !== 0) {
		await deps.unlink(passwordlessPath).catch(() => {})
		throw new Error(
			`ssh-keygen failed (${result.status}): see output above for details`,
		)
	}

	return {
		path: passwordlessPath,
		name: path.basename(passwordlessPath),
	}
}

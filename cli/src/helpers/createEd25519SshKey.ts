import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const DEFAULT_DOTENC_KEY_BASENAME = "id_ed25519_dotenc"

type ResolveNewKeyPathDeps = {
	existsSync: typeof existsSync
}

const defaultResolveNewKeyPathDeps: ResolveNewKeyPathDeps = {
	existsSync,
}

export const _resolveNewDotencSshKeyPath = (
	deps: ResolveNewKeyPathDeps = defaultResolveNewKeyPathDeps,
) => {
	const sshDir = path.join(os.homedir(), ".ssh")
	const basePath = path.join(sshDir, DEFAULT_DOTENC_KEY_BASENAME)

	if (!deps.existsSync(basePath) && !deps.existsSync(`${basePath}.pub`)) {
		return basePath
	}

	for (let index = 1; index < 1000; index += 1) {
		const candidatePath = path.join(
			sshDir,
			`${DEFAULT_DOTENC_KEY_BASENAME}_${index}`,
		)
		if (
			!deps.existsSync(candidatePath) &&
			!deps.existsSync(`${candidatePath}.pub`)
		) {
			return candidatePath
		}
	}

	throw new Error("Could not determine an available SSH key path in ~/.ssh.")
}

type CreateEd25519SshKeyDeps = {
	mkdir: typeof fs.mkdir
	spawnSync: typeof spawnSync
	resolveNewSshKeyPath: () => string
}

const defaultCreateEd25519SshKeyDeps: CreateEd25519SshKeyDeps = {
	mkdir: fs.mkdir,
	spawnSync,
	resolveNewSshKeyPath: () => _resolveNewDotencSshKeyPath(),
}

export const createEd25519SshKey = async (
	deps: CreateEd25519SshKeyDeps = defaultCreateEd25519SshKeyDeps,
) => {
	const keyPath = deps.resolveNewSshKeyPath()
	await deps.mkdir(path.dirname(keyPath), { recursive: true, mode: 0o700 })

	const result = deps.spawnSync(
		"ssh-keygen",
		["-t", "ed25519", "-f", keyPath, "-N", "", "-q", "-C", "dotenc"],
		{
			stdio: "pipe",
			encoding: "utf-8",
		},
	)

	if (result.error) {
		throw new Error(
			`Failed to run ssh-keygen: ${result.error.message || "unknown error"}`,
		)
	}

	if (typeof result.status === "number" && result.status !== 0) {
		const stderr = typeof result.stderr === "string" ? result.stderr.trim() : ""
		const stdout = typeof result.stdout === "string" ? result.stdout.trim() : ""
		throw new Error(
			`ssh-keygen failed (${result.status}): ${stderr || stdout || "unknown error"}`,
		)
	}

	return keyPath
}

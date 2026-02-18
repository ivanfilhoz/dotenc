import { describe, expect, mock, test } from "bun:test"
import type { PathLike } from "node:fs"
import path from "node:path"
import {
	_resolveNewDotencSshKeyPath,
	createEd25519SshKey,
} from "../helpers/createEd25519SshKey"

describe("createEd25519SshKey", () => {
	test("resolves default dotenc key path when available", () => {
		const keyPath = _resolveNewDotencSshKeyPath({
			existsSync: mock((_filePath: PathLike) => false),
		})

		expect(keyPath.endsWith(path.join(".ssh", "id_ed25519_dotenc"))).toBe(true)
	})

	test("resolves suffixed key path when default is already taken", () => {
		const existsSync = mock((filePath: PathLike) => {
			const normalizedPath = String(filePath)
			if (normalizedPath.endsWith(path.join(".ssh", "id_ed25519_dotenc")))
				return true
			if (normalizedPath.endsWith(path.join(".ssh", "id_ed25519_dotenc.pub")))
				return true
			return false
		})

		const keyPath = _resolveNewDotencSshKeyPath({
			existsSync,
		})

		expect(keyPath.endsWith(path.join(".ssh", "id_ed25519_dotenc_1"))).toBe(
			true,
		)
	})

	test("creates an ed25519 key with ssh-keygen", async () => {
		const mkdir = mock(async (_dir: string, _options: unknown) => undefined)
		const spawnSync = mock(
			(_command: string, _args: string[], _options: unknown) =>
				({
					status: 0,
					stdout: "",
					stderr: "",
				}) as never,
		)

		const keyPath = "/tmp/.ssh/id_ed25519_dotenc"
		const created = await createEd25519SshKey({
			mkdir: mkdir as never,
			spawnSync: spawnSync as never,
			resolveNewSshKeyPath: () => keyPath,
		})

		expect(created).toBe(keyPath)
		expect(mkdir).toHaveBeenCalledWith(path.dirname(keyPath), {
			recursive: true,
			mode: 0o700,
		})
		expect(spawnSync).toHaveBeenCalledTimes(1)
		expect(spawnSync.mock.calls[0][0]).toBe("ssh-keygen")
		expect(spawnSync.mock.calls[0][1]).toEqual([
			"-t",
			"ed25519",
			"-f",
			keyPath,
			"-N",
			"",
			"-q",
			"-C",
			"dotenc",
		])
	})
})

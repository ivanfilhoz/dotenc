import { describe, expect, mock, test } from "bun:test"
import type { PathLike } from "node:fs"
import { constants } from "node:fs"
import path from "node:path"
import {
	_resolvePasswordlessSshKeyCopyPath,
	createPasswordlessSshKeyCopy,
} from "../helpers/createPasswordlessSshKeyCopy"

describe("createPasswordlessSshKeyCopy", () => {
	test("resolves default passwordless path when available", () => {
		const sourcePath = "/tmp/.ssh/id_ed25519"
		const resolved = _resolvePasswordlessSshKeyCopyPath(sourcePath, {
			existsSync: mock((_filePath: PathLike) => false),
		})

		expect(resolved).toBe(path.join("/tmp/.ssh", "id_ed25519_passwordless"))
	})

	test("resolves suffixed path when default passwordless path is taken", () => {
		const sourcePath = "/tmp/.ssh/id_ed25519"
		const existsSync = mock((filePath: PathLike) => {
			const normalized = String(filePath)
			return (
				normalized.endsWith(path.join(".ssh", "id_ed25519_passwordless")) ||
				normalized.endsWith(path.join(".ssh", "id_ed25519_passwordless.pub"))
			)
		})

		const resolved = _resolvePasswordlessSshKeyCopyPath(sourcePath, {
			existsSync,
		})

		expect(resolved).toBe(path.join("/tmp/.ssh", "id_ed25519_passwordless_1"))
	})

	test("copies key with secure permissions and removes passphrase via ssh-keygen", async () => {
		const sourcePath = "/tmp/.ssh/id_ed25519"
		const destinationPath = "/tmp/.ssh/id_ed25519_passwordless"
		const copyFile = mock(async () => undefined)
		const chmod = mock(async () => undefined)
		const unlink = mock(async () => undefined)
		const spawnSync = mock(
			(_command: string, _args: string[], _options: unknown) =>
				({
					status: 0,
					stdout: "",
					stderr: "",
				}) as never,
		)

		const created = await createPasswordlessSshKeyCopy(sourcePath, {
			copyFile: copyFile as never,
			chmod: chmod as never,
			unlink: unlink as never,
			spawnSync: spawnSync as never,
			resolvePasswordlessSshKeyCopyPath: () => destinationPath,
		})

		expect(created).toEqual({
			path: destinationPath,
			name: "id_ed25519_passwordless",
		})
		expect(copyFile).toHaveBeenCalledWith(
			sourcePath,
			destinationPath,
			constants.COPYFILE_EXCL,
		)
		expect(chmod).toHaveBeenCalledWith(destinationPath, 0o600)
		expect(spawnSync).toHaveBeenCalledWith(
			"ssh-keygen",
			["-p", "-f", destinationPath, "-N", ""],
			{
				stdio: "inherit",
				encoding: "utf-8",
			},
		)
		expect(unlink).not.toHaveBeenCalled()
	})

	test("throws actionable error when ssh-keygen is missing", async () => {
		const sourcePath = "/tmp/.ssh/id_ed25519"
		const destinationPath = "/tmp/.ssh/id_ed25519_passwordless"
		const unlink = mock(async () => undefined)

		await expect(
			createPasswordlessSshKeyCopy(sourcePath, {
				copyFile: mock(async () => undefined) as never,
				chmod: mock(async () => undefined) as never,
				unlink: unlink as never,
				spawnSync: mock(
					(_command: string, _args: string[], _options: unknown) =>
						({
							error: Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
							status: null,
						}) as never,
				) as never,
				resolvePasswordlessSshKeyCopyPath: () => destinationPath,
			}),
		).rejects.toThrow("command not found")

		expect(unlink).toHaveBeenCalledWith(destinationPath)
	})

	test("wraps copyFile failure and does not call unlink when copy was never created", async () => {
		const sourcePath = "/tmp/.ssh/id_ed25519"
		const destinationPath = "/tmp/.ssh/id_ed25519_passwordless"
		const unlink = mock(async () => undefined)

		await expect(
			createPasswordlessSshKeyCopy(sourcePath, {
				copyFile: mock(async () => {
					throw new Error("disk full")
				}) as never,
				chmod: mock(async () => undefined) as never,
				unlink: unlink as never,
				spawnSync: mock(
					(_command: string, _args: string[], _options: unknown) =>
						({ status: 0 }) as never,
				) as never,
				resolvePasswordlessSshKeyCopyPath: () => destinationPath,
			}),
		).rejects.toThrow("Failed to create passwordless key copy")

		expect(unlink).not.toHaveBeenCalled()
	})

	test("throws when ssh-keygen fails and cleans up copy", async () => {
		const sourcePath = "/tmp/.ssh/id_ed25519"
		const destinationPath = "/tmp/.ssh/id_ed25519_passwordless"
		const unlink = mock(async () => undefined)

		await expect(
			createPasswordlessSshKeyCopy(sourcePath, {
				copyFile: mock(async () => undefined) as never,
				chmod: mock(async () => undefined) as never,
				unlink: unlink as never,
				spawnSync: mock(
					(_command: string, _args: string[], _options: unknown) =>
						({
							status: 1,
							stderr: "incorrect passphrase",
							stdout: "",
						}) as never,
				) as never,
				resolvePasswordlessSshKeyCopyPath: () => destinationPath,
			}),
		).rejects.toThrow("ssh-keygen failed (1)")

		expect(unlink).toHaveBeenCalledWith(destinationPath)
	})
})

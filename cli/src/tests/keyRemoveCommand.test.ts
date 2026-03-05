import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as realFs from "node:fs"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import fs, * as realFsPromises from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const confirmPromptMock = mock(async (_msg: string) => true)
const choosePublicKeyPromptMock = mock(async (_msg: string) => "alice")
const validateKeyNameMock = mock((name: string) =>
	name.startsWith("../")
		? { valid: false as const, reason: "invalid key name" }
		: { valid: true as const },
)
const resolveProjectRoot = mock((_dir: string, _existsSync: unknown) =>
	process.cwd(),
)
const fsUnlink = mock(async (_filePath: string) => {})
const existsSync = mock((_p: string) => true)

mock.module("../prompts/confirm", () => ({ confirmPrompt: confirmPromptMock }))
mock.module("../prompts/choosePublicKey", () => ({
	choosePublicKeyPrompt: choosePublicKeyPromptMock,
}))
mock.module("../helpers/validateKeyName", () => ({
	validateKeyName: validateKeyNameMock,
}))
mock.module("../helpers/resolveProjectRoot", () => ({ resolveProjectRoot }))
mock.module("node:fs", () => ({ ...realFs, existsSync, default: realFs }))
mock.module("node:fs/promises", () => ({
	...realFsPromises,
	default: { ...realFsPromises, unlink: fsUnlink },
}))

const { keyRemoveCommand } = await import("../commands/key/remove")

describe("keyRemoveCommand", () => {
	beforeEach(() => {
		confirmPromptMock.mockClear()
		choosePublicKeyPromptMock.mockClear()
		validateKeyNameMock.mockClear()
		resolveProjectRoot.mockClear()
		fsUnlink.mockClear()
		existsSync.mockClear()
		existsSync.mockImplementation(() => true)
	})

	test("rejects invalid key names before touching filesystem", async () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(
			(code?: number) => {
				throw new Error(`process.exit(${code})`)
			},
		)
		const errorSpy = spyOn(console, "error").mockImplementation(() => {})

		try {
			await expect(keyRemoveCommand("../alice")).rejects.toThrow(
				"process.exit(1)",
			)
			expect(exitSpy).toHaveBeenCalledWith(1)
			expect(errorSpy).toHaveBeenCalled()
		} finally {
			exitSpy.mockRestore()
			errorSpy.mockRestore()
		}
	})

	test("removes key file when user confirms", async () => {
		const workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-remove-"))
		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		const keyPath = path.join(workspace, ".dotenc", "alice.pub")
		writeFileSync(keyPath, "fake-public-key", "utf-8")
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)
		resolveProjectRoot.mockImplementation(() => workspace)
		confirmPromptMock.mockImplementation(async () => true)
		existsSync.mockImplementation(() => true)

		const logSpy = spyOn(console, "log").mockImplementation(() => {})

		try {
			await keyRemoveCommand("alice")
			expect(confirmPromptMock).toHaveBeenCalledTimes(1)
			expect(fsUnlink).toHaveBeenCalledWith(keyPath)
		} finally {
			logSpy.mockRestore()
			cwdSpy.mockRestore()
			resolveProjectRoot.mockImplementation(() => process.cwd())
			rmSync(workspace, { recursive: true, force: true })
		}
	})

	test("keeps key file when user cancels removal", async () => {
		const workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-cancel-"))
		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		const keyPath = path.join(workspace, ".dotenc", "alice.pub")
		writeFileSync(keyPath, "fake-public-key", "utf-8")
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)
		resolveProjectRoot.mockImplementation(() => workspace)
		confirmPromptMock.mockImplementation(async () => false)
		existsSync.mockImplementation(() => true)

		const logSpy = spyOn(console, "log").mockImplementation(() => {})

		try {
			await keyRemoveCommand("alice")
			expect(confirmPromptMock).toHaveBeenCalledTimes(1)
			expect(fsUnlink).not.toHaveBeenCalled()
		} finally {
			logSpy.mockRestore()
			cwdSpy.mockRestore()
			resolveProjectRoot.mockImplementation(() => process.cwd())
			rmSync(workspace, { recursive: true, force: true })
		}
	})

	test("fails when key file does not exist", async () => {
		const workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-missing-"))
		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)
		resolveProjectRoot.mockImplementation(() => workspace)
		existsSync.mockImplementation(() => false)

		const exitSpy = spyOn(process, "exit").mockImplementation(
			(code?: number) => {
				throw new Error(`process.exit(${code})`)
			},
		)
		const errorSpy = spyOn(console, "error").mockImplementation(() => {})

		try {
			await expect(keyRemoveCommand("alice")).rejects.toThrow("process.exit(1)")
			expect(errorSpy).toHaveBeenCalled()
		} finally {
			errorSpy.mockRestore()
			exitSpy.mockRestore()
			cwdSpy.mockRestore()
			resolveProjectRoot.mockImplementation(() => process.cwd())
			rmSync(workspace, { recursive: true, force: true })
		}
	})

	test("prints offboarding hint after removing key", async () => {
		const workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-hint-"))
		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		const keyPath = path.join(workspace, ".dotenc", "alice.pub")
		writeFileSync(keyPath, "fake-public-key", "utf-8")
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => workspace)
		confirmPromptMock.mockImplementation(async () => true)
		existsSync.mockImplementation(() => true)
		// fsUnlink is already mocked to a no-op by default

		try {
			await keyRemoveCommand("alice")
			const logged = logSpy.mock.calls.map((call) => String(call[0]))
			expect(logged.some((msg) => msg.includes("dotenc auth purge"))).toBe(true)
		} finally {
			logSpy.mockRestore()
			cwdSpy.mockRestore()
			resolveProjectRoot.mockImplementation(() => process.cwd())
			rmSync(workspace, { recursive: true, force: true })
		}
	})
})

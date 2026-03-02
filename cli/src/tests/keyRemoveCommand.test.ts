import { describe, expect, mock, spyOn, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import inquirer from "inquirer"
import type { KeyRemoveCommandDeps } from "../commands/key/remove"
import { keyRemoveCommand } from "../commands/key/remove"

describe("keyRemoveCommand", () => {
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

		const promptSpy = spyOn(inquirer, "prompt").mockResolvedValue({
			confirm: true,
		} as never)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})

		try {
			await keyRemoveCommand("alice")
			expect(promptSpy).toHaveBeenCalledTimes(1)
			expect(existsSync(keyPath)).toBe(false)
		} finally {
			logSpy.mockRestore()
			promptSpy.mockRestore()
			cwdSpy.mockRestore()
			rmSync(workspace, { recursive: true, force: true })
		}
	})

	test("keeps key file when user cancels removal", async () => {
		const workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-cancel-"))
		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		const keyPath = path.join(workspace, ".dotenc", "alice.pub")
		writeFileSync(keyPath, "fake-public-key", "utf-8")
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)

		const promptSpy = spyOn(inquirer, "prompt").mockResolvedValue({
			confirm: false,
		} as never)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})

		try {
			await keyRemoveCommand("alice")
			expect(promptSpy).toHaveBeenCalledTimes(1)
			expect(existsSync(keyPath)).toBe(true)
		} finally {
			logSpy.mockRestore()
			promptSpy.mockRestore()
			cwdSpy.mockRestore()
			rmSync(workspace, { recursive: true, force: true })
		}
	})

	test("fails when key file does not exist", async () => {
		const workspace = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-missing-"))
		await fs.mkdir(path.join(workspace, ".dotenc"), { recursive: true })
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(workspace)

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
			rmSync(workspace, { recursive: true, force: true })
		}
	})

	test("prints offboarding hint after removing key", async () => {
		const log = mock((_message: string) => {})
		const unlink = mock(async (_filePath: string) => {})

		const deps: KeyRemoveCommandDeps = {
			validateKeyName: (() => ({
				valid: true,
			})) as KeyRemoveCommandDeps["validateKeyName"],
			choosePublicKeyPrompt: mock(
				async () => "alice",
			) as unknown as KeyRemoveCommandDeps["choosePublicKeyPrompt"],
			confirmPrompt: mock(
				async () => true,
			) as unknown as KeyRemoveCommandDeps["confirmPrompt"],
			existsSync: (() => true) as KeyRemoveCommandDeps["existsSync"],
			unlink: unlink as unknown as KeyRemoveCommandDeps["unlink"],
			cwd: () => "/tmp/dotenc-key-remove-hint",
			log,
			logError: mock((_message: string) => {}),
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		}

		await keyRemoveCommand("alice", deps)

		const logged = log.mock.calls.map((call) => String(call[0]))
		expect(logged.some((msg) => msg.includes("dotenc auth purge"))).toBe(true)
	})
})

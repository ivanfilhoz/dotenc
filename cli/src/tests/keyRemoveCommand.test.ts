import { describe, expect, spyOn, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import inquirer from "inquirer"
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
})

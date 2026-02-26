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

	test("auto-revokes affected environments and skips unreadable ones", async () => {
		const log = mock((_message: string) => {})
		const warn = mock((_message: string) => {})
		const unlink = mock(async (_filePath: string) => {})
		const getEnvironmentByName = mock(async (envName: string) => {
			if (envName === "broken") {
				throw new Error("cannot read")
			}
			if (envName === "prod") {
				return { keys: [{ name: "charlie" }] } as never
			}
			return { keys: [{ name: "alice" }] } as never
		})
		const decryptEnvironmentData = mock(async (_env: object) => "SECRET=1")
		const encryptEnvironment = mock(
			async (_name: string, _content: string, _options?: object) => {},
		)

		const deps = {
			decryptEnvironmentData:
				decryptEnvironmentData as unknown as KeyRemoveCommandDeps["decryptEnvironmentData"],
			encryptEnvironment:
				encryptEnvironment as unknown as KeyRemoveCommandDeps["encryptEnvironment"],
			getEnvironmentByName:
				getEnvironmentByName as unknown as KeyRemoveCommandDeps["getEnvironmentByName"],
			getEnvironments: mock(async () => [
				"broken",
				"dev",
				"prod",
			]) as unknown as KeyRemoveCommandDeps["getEnvironments"],
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
			cwd: () => "/tmp/dotenc-key-remove-deps",
			log,
			logError: mock((_message: string) => {}),
			warn,
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		} as KeyRemoveCommandDeps

		await keyRemoveCommand("alice", deps)

		expect(unlink).toHaveBeenCalledWith(
			path.join("/tmp/dotenc-key-remove-deps", ".dotenc", "alice.pub"),
		)
		expect(decryptEnvironmentData).toHaveBeenCalledTimes(1)
		expect(encryptEnvironment).toHaveBeenCalledWith("dev", "SECRET=1", {
			revokePublicKeys: ["alice"],
		})
		expect(warn).not.toHaveBeenCalled()

		const logged = log.mock.calls.map((call) => String(call[0]))
		expect(
			logged.some((message) =>
				message.includes("has access to the following environments"),
			),
		).toBe(true)
		expect(
			logged.some(
				(message) =>
					message.includes("Revoked access from") && message.includes("dev"),
			),
		).toBe(true)
	})

	test("warns when automatic revocation fails after key removal", async () => {
		const warn = mock((_message: string) => {})
		const unlink = mock(async (_filePath: string) => {})
		const encryptEnvironment = mock(async () => {
			throw new Error("re-encrypt failed")
		})

		const deps = {
			decryptEnvironmentData: mock(
				async (_env: object) => "SECRET=1",
			) as unknown as KeyRemoveCommandDeps["decryptEnvironmentData"],
			encryptEnvironment:
				encryptEnvironment as unknown as KeyRemoveCommandDeps["encryptEnvironment"],
			getEnvironmentByName: mock(async (_envName: string) => ({
				keys: [{ name: "alice" }],
			})) as unknown as KeyRemoveCommandDeps["getEnvironmentByName"],
			getEnvironments: mock(async () => [
				"staging",
			]) as unknown as KeyRemoveCommandDeps["getEnvironments"],
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
			cwd: () => "/tmp/dotenc-key-remove-deps",
			log: mock((_message: string) => {}),
			logError: mock((_message: string) => {}),
			warn,
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		} as KeyRemoveCommandDeps

		await keyRemoveCommand("alice", deps)

		expect(unlink).toHaveBeenCalledTimes(1)
		expect(encryptEnvironment).toHaveBeenCalledTimes(1)
		expect(warn).toHaveBeenCalledTimes(1)
		expect(String(warn.mock.calls[0]?.[0])).toContain(
			"dotenc auth revoke staging alice",
		)
	})
})

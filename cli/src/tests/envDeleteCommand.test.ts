import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as realFs from "node:fs"
import * as realFsPromises from "node:fs/promises"
import path from "node:path"

const CWD = "/tmp/dotenc-env-delete-test"

const chooseEnvironmentPrompt = mock(async (_msg: string) => "staging")
const confirmPrompt = mock(async (_msg: string) => true)
const validateEnvironmentName = mock((name: string) =>
	name === "invalid!!"
		? { valid: false as const, reason: "invalid environment name" }
		: { valid: true as const },
)
const existsSync = mock((_p: string) => true)
const fsUnlink = mock(async (_filePath: string) => {})

mock.module("../prompts/chooseEnvironment", () => ({ chooseEnvironmentPrompt }))
mock.module("../prompts/confirm", () => ({ confirmPrompt }))
mock.module("../helpers/validateEnvironmentName", () => ({ validateEnvironmentName }))
mock.module("node:fs", () => ({ ...realFs, existsSync }))
mock.module("node:fs/promises", () => ({ ...realFsPromises, default: { ...realFsPromises, unlink: fsUnlink } }))

const { envDeleteCommand } = await import("../commands/env/delete")

describe("envDeleteCommand", () => {
	beforeEach(() => {
		chooseEnvironmentPrompt.mockClear()
		confirmPrompt.mockClear()
		validateEnvironmentName.mockClear()
		existsSync.mockClear()
		fsUnlink.mockClear()
	})

	test("rejects invalid environment names", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(envDeleteCommand("invalid!!", false)).rejects.toThrow("exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(String(logErrorSpy.mock.calls[0]?.[0])).toContain(
			"invalid environment name",
		)
		logErrorSpy.mockRestore()
		exitSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("exits when environment file does not exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})
		existsSync.mockImplementation(() => false)

		await expect(envDeleteCommand("staging", false)).rejects.toThrow("exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(String(logErrorSpy.mock.calls[0]?.[0])).toContain("not found")
		logErrorSpy.mockRestore()
		exitSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("prompts for environment when arg is missing", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		existsSync.mockImplementation(() => true)
		chooseEnvironmentPrompt.mockImplementation(async () => "staging")
		fsUnlink.mockImplementation(async () => {})

		await envDeleteCommand("", true)

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(fsUnlink).toHaveBeenCalledWith(path.join(CWD, ".env.staging.enc"))
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("deletes file in cwd when confirmed", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		existsSync.mockImplementation(() => true)
		confirmPrompt.mockImplementation(async () => true)
		fsUnlink.mockImplementation(async () => {})

		await envDeleteCommand("staging", false)

		expect(confirmPrompt).toHaveBeenCalledTimes(1)
		expect(fsUnlink).toHaveBeenCalledWith(path.join(CWD, ".env.staging.enc"))
		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("deleted"))).toBe(true)
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("aborts when user declines", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		existsSync.mockImplementation(() => true)
		confirmPrompt.mockImplementation(async () => false)

		await envDeleteCommand("staging", false)

		expect(fsUnlink).not.toHaveBeenCalled()
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("skips confirmation when yes=true", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		existsSync.mockImplementation(() => true)
		fsUnlink.mockImplementation(async () => {})

		await envDeleteCommand("staging", true)

		expect(confirmPrompt).not.toHaveBeenCalled()
		expect(fsUnlink).toHaveBeenCalledTimes(1)
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})
})

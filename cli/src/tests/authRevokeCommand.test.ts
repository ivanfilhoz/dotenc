import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import path from "node:path"

const CWD = "/tmp/dotenc-revoke-test"

const chooseEnvironmentPrompt = mock(async (_msg: string) => "staging")
const choosePublicKeyPrompt = mock(async (_msg: string) => "bob")
const decryptEnvironment = mock(async (_name: string) => "TOKEN=secret")
const getPublicKeyByName = mock(async (_name: string) => ({}))
const encryptEnvironment = mock(async (_name: string, _content: string, _options?: object) => {})
const validateEnvironmentName = mock((name: string) =>
	name === "invalid"
		? { valid: false as const, reason: "invalid environment" }
		: { valid: true as const },
)

mock.module("../prompts/chooseEnvironment", () => ({ chooseEnvironmentPrompt }))
mock.module("../prompts/choosePublicKey", () => ({ choosePublicKeyPrompt }))
mock.module("../helpers/decryptEnvironment", () => ({ decryptEnvironment, decryptEnvironmentData: decryptEnvironment }))
mock.module("../helpers/getPublicKeyByName", () => ({ getPublicKeyByName }))
mock.module("../helpers/encryptEnvironment", () => ({ encryptEnvironment }))
mock.module("../helpers/validateEnvironmentName", () => ({ validateEnvironmentName }))

const { revokeCommand } = await import("../commands/auth/revoke")

describe("revokeCommand", () => {
	beforeEach(() => {
		chooseEnvironmentPrompt.mockClear()
		choosePublicKeyPrompt.mockClear()
		decryptEnvironment.mockClear()
		getPublicKeyByName.mockClear()
		encryptEnvironment.mockClear()
		validateEnvironmentName.mockClear()
	})

	test("prompts for missing args and revokes access", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		chooseEnvironmentPrompt.mockImplementation(async () => "staging")
		choosePublicKeyPrompt.mockImplementation(async () => "bob")
		decryptEnvironment.mockImplementation(async () => "TOKEN=secret")
		getPublicKeyByName.mockImplementation(async () => ({}))
		encryptEnvironment.mockImplementation(async () => {})

		await revokeCommand("", "")

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(choosePublicKeyPrompt).toHaveBeenCalledTimes(1)
		expect(decryptEnvironment).toHaveBeenCalledWith("staging")
		expect(getPublicKeyByName).toHaveBeenCalledWith("bob")
		expect(encryptEnvironment).toHaveBeenCalledWith("staging", "TOKEN=secret", {
			revokePublicKeys: ["bob"],
			baseDir: CWD,
		})
		cwdSpy.mockRestore()
	})

	test("encrypts to cwd, not projectRoot, in a monorepo", async () => {
		const SUBDIR = path.join("/workspace", "packages", "web")
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(SUBDIR)
		decryptEnvironment.mockImplementation(async () => "TOKEN=secret")
		getPublicKeyByName.mockImplementation(async () => ({}))
		encryptEnvironment.mockImplementation(async () => {})

		await revokeCommand("staging", "bob")

		const options = encryptEnvironment.mock.calls[0]?.[2] as {
			baseDir?: string
		}
		expect(options?.baseDir).toBe(SUBDIR)
		cwdSpy.mockRestore()
	})

	test("exits on invalid environment name", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(revokeCommand("invalid", "bob")).rejects.toThrow("exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(decryptEnvironment).not.toHaveBeenCalled()
		expect(String(logErrorSpy.mock.calls[0]?.[0])).toContain("invalid environment")
		logErrorSpy.mockRestore()
		exitSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("exits when decryption fails", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})
		decryptEnvironment.mockImplementation(async () => {
			throw new Error("decrypt failed")
		})

		await expect(revokeCommand("staging", "bob")).rejects.toThrow("exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(logErrorSpy).toHaveBeenCalledWith("decrypt failed")
		logErrorSpy.mockRestore()
		exitSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("exits when public key lookup fails", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})
		decryptEnvironment.mockImplementation(async () => "TOKEN=secret")
		getPublicKeyByName.mockImplementation(async () => {
			throw new Error("key not found")
		})

		await expect(revokeCommand("staging", "bob")).rejects.toThrow("exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(logErrorSpy).toHaveBeenCalledWith("key not found")
		logErrorSpy.mockRestore()
		exitSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("exits when encryption fails", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(CWD)
		const logErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})
		decryptEnvironment.mockImplementation(async () => "TOKEN=secret")
		getPublicKeyByName.mockImplementation(async () => ({}))
		encryptEnvironment.mockImplementation(async () => {
			throw new Error("encrypt failed")
		})

		await expect(revokeCommand("staging", "bob")).rejects.toThrow("exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(logErrorSpy).toHaveBeenCalledWith("encrypt failed")
		logErrorSpy.mockRestore()
		exitSpy.mockRestore()
		cwdSpy.mockRestore()
	})
})

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as realFs from "node:fs"
import path from "node:path"

const ROOT = "/workspace"
const SUBDIR = path.join(ROOT, "packages", "web")

const makeKey = (name: string) => ({
	name,
	algorithm: "ed25519" as const,
	fingerprint: `SHA256:${name}`,
	publicKey: {} as never,
	rawPublicKey: Buffer.alloc(32),
})

const getPublicKeys = mock(async (_dotencDir: string) => [] as ReturnType<typeof makeKey>[])
const resolveProjectRoot = mock((_dir: string, _existsSync: unknown) => ROOT)
const existsSync = mock((_p: string) => true)

mock.module("../helpers/getPublicKeys", () => ({ getPublicKeys }))
mock.module("../helpers/resolveProjectRoot", () => ({ resolveProjectRoot }))
mock.module("node:fs", () => ({ ...realFs, existsSync }))

const { keyListCommand } = await import("../commands/key/list")

describe("keyListCommand", () => {
	beforeEach(() => {
		getPublicKeys.mockClear()
		resolveProjectRoot.mockClear()
		existsSync.mockClear()
	})

	test("prints 'No public keys found' when none exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		getPublicKeys.mockImplementation(async () => [])

		await keyListCommand()

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("No public keys found"))).toBe(true)
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("lists keys with name and algorithm", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		getPublicKeys.mockImplementation(async () => [makeKey("alice"), makeKey("bob")])

		await keyListCommand()

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("alice"))).toBe(true)
		expect(logged.some((m) => m.includes("bob"))).toBe(true)
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("reads from projectRoot .dotenc when cwd is a subdir", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(SUBDIR)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		getPublicKeys.mockImplementation(async () => [makeKey("alice")])

		await keyListCommand()

		// Should call getPublicKeys with ROOT/.dotenc, not SUBDIR/.dotenc
		const calledWith = String(getPublicKeys.mock.calls[0]?.[0])
		expect(calledWith).toBe(path.join(ROOT, ".dotenc"))
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("falls back to cwd when resolveProjectRoot throws", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => {
			throw new Error("not a project")
		})
		getPublicKeys.mockImplementation(async () => [])

		await keyListCommand()

		const calledWith = String(getPublicKeys.mock.calls[0]?.[0])
		expect(calledWith).toBe(path.join(ROOT, ".dotenc"))
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})
})

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as realFs from "node:fs"
import path from "node:path"

const ROOT = "/workspace"
const SUBDIR = path.join(ROOT, "packages", "web")

const getEnvironments = mock(async (_dir?: string) => [] as string[])
const findEnvironmentsRecursive = mock(async (_dir: string) => [] as Array<{ name: string; dir: string; filePath: string }>)
const resolveProjectRoot = mock((_dir: string, _existsSync: unknown) => ROOT)
const existsSync = mock((_p: string) => true)

mock.module("../helpers/getEnvironments", () => ({ getEnvironments }))
mock.module("../helpers/findEnvironmentsRecursive", () => ({ findEnvironmentsRecursive }))
mock.module("../helpers/resolveProjectRoot", () => ({ resolveProjectRoot }))
mock.module("node:fs", () => ({ ...realFs, existsSync }))

const { envListCommand } = await import("../commands/env/list")

describe("envListCommand — default (local only)", () => {
	beforeEach(() => {
		getEnvironments.mockClear()
		findEnvironmentsRecursive.mockClear()
		resolveProjectRoot.mockClear()
		existsSync.mockClear()
	})

	test("prints 'No environments found' when none exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		getEnvironments.mockImplementation(async () => [])

		await envListCommand({})

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["No environments found."])
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("prints environment names flat, without folder labels", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		getEnvironments.mockImplementation(async () => ["staging", "production"])

		await envListCommand({})

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["staging", "production"])
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("--json outputs { environments: [] } when none exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		getEnvironments.mockImplementation(async () => [])

		await envListCommand({ json: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		expect(JSON.parse(logged[0])).toEqual({ environments: [] })
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("--json outputs { environments: [...] } with name/dir/filePath", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		getEnvironments.mockImplementation(async () => ["staging", "production"])

		await envListCommand({ json: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		const parsed = JSON.parse(logged[0]) as {
			environments: Array<{ name: string; dir: string; filePath: string }>
		}
		expect(parsed.environments).toEqual([
			{
				name: "staging",
				dir: ROOT,
				filePath: path.join(ROOT, ".env.staging.enc"),
			},
			{
				name: "production",
				dir: ROOT,
				filePath: path.join(ROOT, ".env.production.enc"),
			},
		])
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})
})

describe("envListCommand — --all (recursive)", () => {
	const webFiles = [
		{
			name: "production",
			dir: ROOT,
			filePath: path.join(ROOT, ".env.production.enc"),
		},
		{
			name: "staging",
			dir: SUBDIR,
			filePath: path.join(SUBDIR, ".env.staging.enc"),
		},
	]

	beforeEach(() => {
		getEnvironments.mockClear()
		findEnvironmentsRecursive.mockClear()
		resolveProjectRoot.mockClear()
		existsSync.mockClear()
	})

	test("prints 'No environments found' when none exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(SUBDIR)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		findEnvironmentsRecursive.mockImplementation(async () => [])

		await envListCommand({ all: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["No environments found."])
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("prints environment names with relative folder labels", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(SUBDIR)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		findEnvironmentsRecursive.mockImplementation(async () => webFiles)

		await envListCommand({ all: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["production  (.)", "staging  (packages/web)"])
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("--json outputs { environments: [] } when none exist", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(SUBDIR)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		findEnvironmentsRecursive.mockImplementation(async () => [])

		await envListCommand({ all: true, json: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		expect(JSON.parse(logged[0])).toEqual({ environments: [] })
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("--json outputs { environments: [...] } with all entries across dirs", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(SUBDIR)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => ROOT)
		findEnvironmentsRecursive.mockImplementation(async () => webFiles)

		await envListCommand({ all: true, json: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		const parsed = JSON.parse(logged[0]) as {
			environments: Array<{ name: string; dir: string; filePath: string }>
		}
		expect(parsed.environments).toEqual(webFiles)
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})

	test("uses cwd as project root when not in a dotenc project", async () => {
		const cwdSpy = spyOn(process, "cwd").mockReturnValue(ROOT)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		resolveProjectRoot.mockImplementation(() => {
			throw new Error("Not in a dotenc project")
		})
		findEnvironmentsRecursive.mockImplementation(async (rootDir: string) => [
			{
				name: "dev",
				dir: rootDir,
				filePath: path.join(rootDir, ".env.dev.enc"),
			},
		])

		await envListCommand({ all: true })

		const logged = logSpy.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["dev  (.)"])
		logSpy.mockRestore()
		cwdSpy.mockRestore()
	})
})

import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import type { EnvListCommandDeps } from "../commands/env/list"
import { envListCommand } from "../commands/env/list"

const ROOT = "/workspace"
const SUBDIR = path.join(ROOT, "packages", "web")

describe("envListCommand — default (local only)", () => {
	test("prints 'No environments found' when none exist", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{},
			{
				getEnvironments: mock(
					async () => [],
				) as unknown as EnvListCommandDeps["getEnvironments"],
				cwd: () => ROOT,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["No environments found."])
	})

	test("prints environment names flat, without folder labels", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{},
			{
				getEnvironments: mock(async () => [
					"staging",
					"production",
				]) as unknown as EnvListCommandDeps["getEnvironments"],
				cwd: () => ROOT,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["staging", "production"])
	})

	test("--json outputs { environments: [] } when none exist", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ json: true },
			{
				getEnvironments: mock(
					async () => [],
				) as unknown as EnvListCommandDeps["getEnvironments"],
				cwd: () => ROOT,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		expect(JSON.parse(logged[0])).toEqual({ environments: [] })
	})

	test("--json outputs { environments: [...] } with name/dir/filePath", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ json: true },
			{
				getEnvironments: mock(async () => [
					"staging",
					"production",
				]) as unknown as EnvListCommandDeps["getEnvironments"],
				cwd: () => ROOT,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
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

	test("prints 'No environments found' when none exist", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ all: true },
			{
				findEnvironmentsRecursive: mock(
					async () => [],
				) as unknown as EnvListCommandDeps["findEnvironmentsRecursive"],
				resolveProjectRoot: () => ROOT,
				existsSync: () => true,
				cwd: () => SUBDIR,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["No environments found."])
	})

	test("prints environment names with relative folder labels", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ all: true },
			{
				findEnvironmentsRecursive: mock(
					async () => webFiles,
				) as unknown as EnvListCommandDeps["findEnvironmentsRecursive"],
				resolveProjectRoot: () => ROOT,
				existsSync: () => true,
				cwd: () => SUBDIR,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["production  (.)", "staging  (packages/web)"])
	})

	test("--json outputs { environments: [] } when none exist", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ all: true, json: true },
			{
				findEnvironmentsRecursive: mock(
					async () => [],
				) as unknown as EnvListCommandDeps["findEnvironmentsRecursive"],
				resolveProjectRoot: () => ROOT,
				existsSync: () => true,
				cwd: () => SUBDIR,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		expect(JSON.parse(logged[0])).toEqual({ environments: [] })
	})

	test("--json outputs { environments: [...] } with all entries across dirs", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ all: true, json: true },
			{
				findEnvironmentsRecursive: mock(
					async () => webFiles,
				) as unknown as EnvListCommandDeps["findEnvironmentsRecursive"],
				resolveProjectRoot: () => ROOT,
				existsSync: () => true,
				cwd: () => SUBDIR,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toHaveLength(1)
		const parsed = JSON.parse(logged[0]) as {
			environments: Array<{ name: string; dir: string; filePath: string }>
		}
		expect(parsed.environments).toEqual(webFiles)
	})

	test("uses cwd as project root when not in a dotenc project", async () => {
		const log = mock((_msg: string) => {})

		await envListCommand(
			{ all: true },
			{
				findEnvironmentsRecursive: mock(async (rootDir: string) => [
					{
						name: "dev",
						dir: rootDir,
						filePath: path.join(rootDir, ".env.dev.enc"),
					},
				]) as unknown as EnvListCommandDeps["findEnvironmentsRecursive"],
				resolveProjectRoot: () => {
					throw new Error("Not in a dotenc project")
				},
				existsSync: () => false,
				cwd: () => ROOT,
				log,
			},
		)

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged).toEqual(["dev  (.)"])
	})
})

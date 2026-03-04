import { describe, expect, test } from "bun:test"
import type { Dirent } from "node:fs"
import path from "node:path"
import { findEnvironmentsRecursive } from "../helpers/findEnvironmentsRecursive"

const makeDirent = (name: string, isDir: boolean): Dirent<string> =>
	({
		name,
		isDirectory: () => isDir,
		isFile: () => !isDir,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isSymbolicLink: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		path: "",
		parentPath: "",
	}) as unknown as Dirent<string>

type ReaddirFn = (
	dir: string,
	options: { withFileTypes: true },
) => Promise<Dirent<string>[]>

const makeReaddir =
	(map: Record<string, Dirent<string>[]>): ReaddirFn =>
	async (dir) =>
		map[dir] ?? []

describe("findEnvironmentsRecursive", () => {
	test("finds env files at root", async () => {
		const root = "/workspace"
		const readdir = makeReaddir({
			[root]: [
				makeDirent(".env.staging.enc", false),
				makeDirent("package.json", false),
			],
		})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(1)
		expect(results[0].name).toBe("staging")
		expect(results[0].dir).toBe(root)
		expect(results[0].filePath).toBe(path.join(root, ".env.staging.enc"))
	})

	test("finds env files in subdirectories recursively", async () => {
		const root = "/workspace"
		const subdir = path.join(root, "packages", "web")
		const readdir = makeReaddir({
			[root]: [makeDirent("packages", true)],
			[path.join(root, "packages")]: [makeDirent("web", true)],
			[subdir]: [makeDirent(".env.production.enc", false)],
		})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(1)
		expect(results[0].name).toBe("production")
		expect(results[0].dir).toBe(subdir)
	})

	test("ignores node_modules directory", async () => {
		const root = "/workspace"
		const nm = path.join(root, "node_modules")
		const readdir = makeReaddir({
			[root]: [
				makeDirent("node_modules", true),
				makeDirent(".env.staging.enc", false),
			],
			[nm]: [makeDirent(".env.secret.enc", false)],
		})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(1)
		expect(results[0].name).toBe("staging")
	})

	test("ignores .git directory", async () => {
		const root = "/workspace"
		const git = path.join(root, ".git")
		const readdir = makeReaddir({
			[root]: [makeDirent(".git", true)],
			[git]: [makeDirent(".env.secret.enc", false)],
		})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(0)
	})

	test("ignores dist directory", async () => {
		const root = "/workspace"
		const dist = path.join(root, "dist")
		const readdir = makeReaddir({
			[root]: [makeDirent("dist", true)],
			[dist]: [makeDirent(".env.staging.enc", false)],
		})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(0)
	})

	test("returns empty array for empty directory", async () => {
		const root = "/workspace"
		const readdir = makeReaddir({})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(0)
	})

	test("returns correct name, dir, and filePath for each file", async () => {
		const root = "/project"
		const readdir = makeReaddir({
			[root]: [
				makeDirent(".env.staging.enc", false),
				makeDirent(".env.production.enc", false),
			],
		})

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(2)
		const names = results.map((r) => r.name).sort()
		expect(names).toEqual(["production", "staging"])
		for (const r of results) {
			expect(r.dir).toBe(root)
			expect(r.filePath).toBe(path.join(root, `.env.${r.name}.enc`))
		}
	})

	test("does not crash when readdir throws for a subdir", async () => {
		const root = "/workspace"
		const broken = path.join(root, "broken")
		const readdir: ReaddirFn = async (dir) => {
			if (dir === root) {
				return [
					makeDirent("broken", true),
					makeDirent(".env.staging.enc", false),
				]
			}
			if (dir === broken) {
				throw new Error("Permission denied")
			}
			return []
		}

		const results = await findEnvironmentsRecursive(root, readdir)
		expect(results).toHaveLength(1)
		expect(results[0].name).toBe("staging")
	})
})

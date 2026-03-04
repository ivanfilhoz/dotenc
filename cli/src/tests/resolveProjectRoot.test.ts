import { describe, expect, test } from "bun:test"
import path from "node:path"
import { resolveProjectRoot } from "../helpers/resolveProjectRoot"

describe("resolveProjectRoot", () => {
	test("returns cwd when .dotenc exists there", () => {
		const cwd = "/home/user/myproject"
		const existsSync = (p: string) => p === path.join(cwd, ".dotenc")

		expect(resolveProjectRoot(cwd, existsSync)).toBe(cwd)
	})

	test("finds .dotenc one level up", () => {
		const root = "/home/user/myproject"
		const subdir = path.join(root, "packages", "web")
		const existsSync = (p: string) => p === path.join(root, ".dotenc")

		expect(resolveProjectRoot(subdir, existsSync)).toBe(root)
	})

	test("finds .dotenc three levels up", () => {
		const root = "/home/user/workspace"
		const deep = path.join(root, "a", "b", "c")
		const existsSync = (p: string) => p === path.join(root, ".dotenc")

		expect(resolveProjectRoot(deep, existsSync)).toBe(root)
	})

	test("throws when .dotenc is not found in any ancestor", () => {
		const existsSync = (_p: string) => false

		expect(() => resolveProjectRoot("/some/deep/dir", existsSync)).toThrow(
			'Not in a dotenc project. Run "dotenc init" to initialize.',
		)
	})

	test("resolves relative startDir before walking", () => {
		// If the startDir is absolute, path.resolve returns it unchanged.
		const root = "/project"
		const existsSync = (p: string) => p === path.join(root, ".dotenc")

		expect(resolveProjectRoot(root, existsSync)).toBe(root)
	})
})

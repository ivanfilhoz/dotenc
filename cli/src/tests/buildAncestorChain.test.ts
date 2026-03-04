import { describe, expect, test } from "bun:test"
import path from "node:path"
import { buildAncestorChain } from "../helpers/buildAncestorChain"

describe("buildAncestorChain", () => {
	test("returns single-element array when dirs are equal", () => {
		const dir = "/home/user/project"
		expect(buildAncestorChain(dir, dir)).toEqual([dir])
	})

	test("returns two elements for one level of nesting", () => {
		const root = "/home/user/project"
		const leaf = path.join(root, "packages")
		expect(buildAncestorChain(root, leaf)).toEqual([root, leaf])
	})

	test("returns ordered chain for multiple nesting levels", () => {
		const root = "/workspace"
		const mid = path.join(root, "apps")
		const leaf = path.join(mid, "web")
		expect(buildAncestorChain(root, leaf)).toEqual([root, mid, leaf])
	})

	test("throws when invocationDir is not under projectRoot", () => {
		expect(() =>
			buildAncestorChain("/home/user/project", "/other/location"),
		).toThrow("not under project root")
	})

	test("resolves both paths before comparing", () => {
		const root = "/workspace"
		const leaf = "/workspace/a/b"
		const chain = buildAncestorChain(root, leaf)
		expect(chain[0]).toBe(root)
		expect(chain[chain.length - 1]).toBe(leaf)
		expect(chain.length).toBe(3)
	})
})

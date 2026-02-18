import { describe, expect, test } from "bun:test"
import { _normalizePublicKeyNamesForCreate } from "../commands/env/create"

describe("createCommand key selection normalization", () => {
	test("normalizes a single selected key string into an array", () => {
		expect(_normalizePublicKeyNamesForCreate("ivan")).toEqual(["ivan"])
	})

	test("keeps an array selection unchanged", () => {
		expect(_normalizePublicKeyNamesForCreate(["ivan", "alice"])).toEqual([
			"ivan",
			"alice",
		])
	})

	test("returns empty array for missing or blank selection", () => {
		expect(_normalizePublicKeyNamesForCreate(undefined)).toEqual([])
		expect(_normalizePublicKeyNamesForCreate("")).toEqual([])
		expect(_normalizePublicKeyNamesForCreate("   ")).toEqual([])
	})
})

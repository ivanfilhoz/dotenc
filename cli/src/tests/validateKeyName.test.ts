import { describe, expect, test } from "bun:test"
import { validateKeyName } from "../helpers/validateKeyName"

describe("validateKeyName", () => {
	test("accepts valid names", () => {
		expect(validateKeyName("alice")).toEqual({ valid: true })
		expect(validateKeyName("team-prod")).toEqual({ valid: true })
		expect(validateKeyName("ci_runner")).toEqual({ valid: true })
		expect(validateKeyName("john.doe")).toEqual({ valid: true })
	})

	test("rejects empty name", () => {
		const result = validateKeyName("")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.reason).toContain("must not be empty")
		}
	})

	test("rejects dot path names", () => {
		expect(validateKeyName(".")).toEqual({
			valid: false,
			reason: 'Invalid key name ".".',
		})
		expect(validateKeyName("..")).toEqual({
			valid: false,
			reason: 'Invalid key name "..".',
		})
	})

	test("rejects path traversal and separators", () => {
		for (const name of [
			"../alice",
			"..\\alice",
			"folder/alice",
			"folder\\alice",
		]) {
			const result = validateKeyName(name)
			expect(result.valid).toBe(false)
		}
	})

	test("rejects names with spaces or special characters", () => {
		for (const name of ["alice bob", "alice@corp", "ci$key", "name;rm"]) {
			const result = validateKeyName(name)
			expect(result.valid).toBe(false)
		}
	})
})

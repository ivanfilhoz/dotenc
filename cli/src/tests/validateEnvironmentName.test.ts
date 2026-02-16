import { describe, expect, test } from "bun:test"
import { validateEnvironmentName } from "../helpers/validateEnvironmentName"

describe("validateEnvironmentName", () => {
	test("accepts valid names", () => {
		expect(validateEnvironmentName("development")).toEqual({ valid: true })
		expect(validateEnvironmentName("staging")).toEqual({ valid: true })
		expect(validateEnvironmentName("prod-us")).toEqual({ valid: true })
		expect(validateEnvironmentName("test_env")).toEqual({ valid: true })
		expect(validateEnvironmentName("v1.0")).toEqual({ valid: true })
		expect(validateEnvironmentName("A-Z.0-9_a-z")).toEqual({ valid: true })
	})

	test("rejects empty name", () => {
		const result = validateEnvironmentName("")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.reason).toContain("must not be empty")
		}
	})

	test("rejects path traversal", () => {
		const result = validateEnvironmentName("../traversal")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.reason).toContain("Invalid environment name")
		}
	})

	test("rejects names with spaces", () => {
		const result = validateEnvironmentName("foo bar")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.reason).toContain("Invalid environment name")
		}
	})

	test("rejects names with slashes", () => {
		const result = validateEnvironmentName("foo/bar")
		expect(result.valid).toBe(false)
		if (!result.valid) {
			expect(result.reason).toContain("Invalid environment name")
		}
	})

	test("rejects names with special characters", () => {
		for (const name of ["foo@bar", "env$HOME", "test;rm", "a&b"]) {
			const result = validateEnvironmentName(name)
			expect(result.valid).toBe(false)
		}
	})
})

import { describe, expect, test } from "bun:test"
import crypto from "node:crypto"
import { createHash } from "../helpers/createHash"

describe("createHash", () => {
	test("returns a hex SHA-256 hash", () => {
		const result = createHash("hello")
		const expected = crypto.createHash("sha256").update("hello").digest("hex")
		expect(result).toBe(expected)
	})

	test("returns consistent output for the same input", () => {
		expect(createHash("test")).toBe(createHash("test"))
	})

	test("returns different output for different input", () => {
		expect(createHash("a")).not.toBe(createHash("b"))
	})

	test("handles empty string", () => {
		const expected = crypto.createHash("sha256").update("").digest("hex")
		expect(createHash("")).toBe(expected)
	})
})

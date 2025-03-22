import { describe, expect, test } from "vitest"
import { parseEnv } from "./parseEnv"

describe("parseEnv", () => {
	test("should parse a simple key-value pair", () => {
		const env = parseEnv("FOO=bar")
		expect(env.FOO).toBe("bar")
	})

	test("should parse a key-value pair with a space", () => {
		const env = parseEnv("FOO = bar")
		expect(env.FOO).toBe("bar")
	})

	test("should parse a complex env file", () => {
		const env = parseEnv(`FOO="
bar"
  BAR='baz
foo
'BAZ=123

# Comment here "!#' foo

HELLO = WORLD
`)

		expect(env.FOO).toBe("\nbar")
		expect(env.BAR).toBe("baz\nfoo\n")
		expect(env.BAZ).toBe("123")
		expect(env.HELLO).toBe("WORLD")
	})
})

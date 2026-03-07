// File B: imports ./repro-greeting and expects the real implementation.
// Expected: greet("world") === "Hello, world!"
// Bug: when run after repro-a-mock.test.ts in the same `bun test` invocation,
//      greet("world") returns "MOCKED" — the mock.module call from file A leaked.

import { expect, test } from "bun:test"
import { greet } from "./repro-greeting"

test("real greet says hello", () => {
	expect(greet("world")).toBe("Hello, world!")
})

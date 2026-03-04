// File A: sets up a mock.module replacement for ./repro-greeting.
// Expected: mock works within this file.
// Bug: the mock leaks into repro-b-real.test.ts when both run together.

import { afterAll, expect, mock, test } from "bun:test"

const greet = mock((_name: string) => "MOCKED")
mock.module("./repro-greeting", () => ({ greet }))

const { greet: greetFn } = await import("./repro-greeting")

test("mock returns MOCKED", () => {
	expect(greetFn("world")).toBe("MOCKED")
})

afterAll(() => {
	// Attempting explicit restoration — does NOT prevent the leak for other files.
	mock.restore()
})

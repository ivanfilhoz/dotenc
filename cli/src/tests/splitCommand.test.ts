import { describe, expect, test } from "bun:test"
import { splitCommand } from "../helpers/splitCommand"

describe("splitCommand", () => {
	test("splits command and arguments by whitespace", () => {
		expect(splitCommand("code --wait")).toEqual(["code", "--wait"])
	})

	test("supports quoted arguments", () => {
		expect(
			splitCommand('"C:\\Program Files\\Editor\\editor.exe" --wait'),
		).toEqual(["C:\\Program Files\\Editor\\editor.exe", "--wait"])
	})

	test("supports escaped spaces", () => {
		expect(splitCommand("my\\ editor --flag")).toEqual(["my editor", "--flag"])
	})

	test("returns empty list for blank command", () => {
		expect(splitCommand("   ")).toEqual([])
	})

	test("throws for unterminated quotes", () => {
		expect(() => splitCommand('"code --wait')).toThrow(
			"Unterminated quote in command.",
		)
	})
})

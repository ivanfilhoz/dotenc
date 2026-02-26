import { describe, expect, mock, test } from "bun:test"
import pkg from "../../package.json"
import { mockUpdateCommand } from "../commands/mockupdate"

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (value: string) => value.replace(ansiPattern, "")

const expectedPatchedVersion = (version: string): string => {
	const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/)
	if (!match) return "7.46.0"
	const [, major, minor, patch] = match
	return `${major}.${minor}.${Number(patch) + 1}`
}

describe("mockUpdateCommand", () => {
	test("prints a boxed update notice using the current package version by default", () => {
		const consoleLogSpy = mock((_message: string) => {})
		const originalLog = console.log
		console.log = consoleLogSpy as never

		try {
			mockUpdateCommand()
		} finally {
			console.log = originalLog
		}

		expect(consoleLogSpy).toHaveBeenCalledTimes(1)
		const [output] = consoleLogSpy.mock.calls[0] as [string]
		const rendered = stripAnsi(output)
		expect(rendered).toContain("UPDATE AVAILABLE")
		expect(rendered).toContain(
			`Update available: ${pkg.version} -> ${expectedPatchedVersion(pkg.version)}`,
		)
		expect(rendered).toContain("Run dotenc update to update")
	})

	test("prints a boxed update notice using explicit versions", () => {
		const consoleLogSpy = mock((_message: string) => {})
		const originalLog = console.log
		console.log = consoleLogSpy as never

		try {
			mockUpdateCommand("7.45.0", "7.46.0")
		} finally {
			console.log = originalLog
		}

		expect(consoleLogSpy).toHaveBeenCalledTimes(1)
		const [output] = consoleLogSpy.mock.calls[0] as [string]
		const rendered = stripAnsi(output)
		expect(rendered).toContain("╭")
		expect(rendered).toContain("Update available: 7.45.0 -> 7.46.0")
		expect(rendered).toContain("╰")
	})
})

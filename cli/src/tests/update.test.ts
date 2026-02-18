import { describe, expect, mock, test } from "bun:test"
import { _runUpdateCommand } from "../commands/update"
import {
	compareVersions,
	detectInstallMethod,
	isVersionNewer,
} from "../helpers/update"

describe("update helpers", () => {
	test("detectInstallMethod detects Homebrew install path", () => {
		const method = detectInstallMethod({
			execPath: "/opt/homebrew/bin/dotenc",
			argv: ["dotenc", "whoami"],
			resolveRealPath: () => "/opt/homebrew/Cellar/dotenc/0.5.0/bin/dotenc",
		})
		expect(method).toBe("homebrew")
	})

	test("detectInstallMethod detects Scoop install path", () => {
		const method = detectInstallMethod({
			execPath: "C:\\Users\\ivan\\scoop\\shims\\dotenc.exe",
			argv: ["dotenc", "whoami"],
			resolveRealPath: () =>
				"C:\\Users\\ivan\\scoop\\apps\\dotenc\\current\\dotenc.exe",
		})
		expect(method).toBe("scoop")
	})

	test("detectInstallMethod detects npm global path", () => {
		const method = detectInstallMethod({
			execPath: "/usr/local/bin/node",
			argv: [
				"node",
				"/usr/local/lib/node_modules/@dotenc/cli/dist/cli.js",
				"whoami",
			],
			resolveRealPath: (input) => input,
		})
		expect(method).toBe("npm")
	})

	test("detectInstallMethod falls back to binary", () => {
		const method = detectInstallMethod({
			execPath: "/usr/local/bin/dotenc",
			argv: ["dotenc", "whoami"],
			resolveRealPath: (input) => input,
		})
		expect(method).toBe("binary")
	})

	test("compareVersions handles semantic versions", () => {
		expect(compareVersions("0.5.0", "0.4.9")).toBe(1)
		expect(compareVersions("0.5.0", "0.5.0")).toBe(0)
		expect(compareVersions("0.5.0", "0.5.1")).toBe(-1)
		expect(isVersionNewer("1.0.0", "0.9.9")).toBe(true)
	})
})

describe("updateCommand", () => {
	test("runs brew upgrade when Homebrew install is detected", async () => {
		const runPackageManagerCommand = mock(async () => 0)
		const log = mock((_message: string) => {})

		await _runUpdateCommand({
			detectInstallMethod: () => "homebrew",
			runPackageManagerCommand,
			log,
		})

		expect(runPackageManagerCommand).toHaveBeenCalledWith("brew", [
			"upgrade",
			"dotenc",
		])
	})

	test("runs scoop update when Scoop install is detected", async () => {
		const runPackageManagerCommand = mock(async () => 0)
		const log = mock((_message: string) => {})

		await _runUpdateCommand({
			detectInstallMethod: () => "scoop",
			runPackageManagerCommand,
			log,
		})

		expect(runPackageManagerCommand).toHaveBeenCalledWith("scoop", [
			"update",
			"dotenc",
		])
	})

	test("runs npm install -g when npm install is detected", async () => {
		const runPackageManagerCommand = mock(async () => 0)
		const log = mock((_message: string) => {})

		await _runUpdateCommand({
			detectInstallMethod: () => "npm",
			runPackageManagerCommand,
			log,
		})

		expect(runPackageManagerCommand).toHaveBeenCalledWith("npm", [
			"install",
			"-g",
			"@dotenc/cli",
		])
	})

	test("prints release URL for standalone binary", async () => {
		const runPackageManagerCommand = mock(async () => 0)
		const log = mock((_message: string) => {})

		await _runUpdateCommand({
			detectInstallMethod: () => "binary",
			runPackageManagerCommand,
			log,
		})

		expect(runPackageManagerCommand).not.toHaveBeenCalled()
		expect(
			log.mock.calls.some((call) => String(call[0]).includes("releases")),
		).toBe(true)
	})

	test("exits with command code when updater exits non-zero", async () => {
		const runPackageManagerCommand = mock(async () => 2)
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			_runUpdateCommand({
				detectInstallMethod: () => "npm",
				runPackageManagerCommand,
				log: mock((_message: string) => {}),
				logError: mock((_message: string) => {}),
				exit,
			}),
		).rejects.toThrow("exit(2)")
	})
})

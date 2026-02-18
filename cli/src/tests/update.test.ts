import { describe, expect, mock, test } from "bun:test"
import { EventEmitter } from "node:events"
import {
	_runPackageManagerCommand,
	_runUpdateCommand,
} from "../commands/update"
import {
	compareVersions,
	detectInstallMethod,
	fetchLatestVersion,
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

	test("detectInstallMethod returns unknown for local src/cli.ts runs", () => {
		const method = detectInstallMethod({
			execPath: "/usr/local/bin/bun",
			argv: ["bun", "/Users/dev/repo/cli/src/cli.ts", "whoami"],
			resolveRealPath: (input) => input,
		})
		expect(method).toBe("unknown")
	})

	test("detectInstallMethod returns unknown for local dist/cli.js runs", () => {
		const method = detectInstallMethod({
			execPath: "/usr/local/bin/node",
			argv: ["node", "/Users/dev/repo/cli/dist/cli.js", "whoami"],
			resolveRealPath: (input) => input,
		})
		expect(method).toBe("unknown")
	})

	test("detectInstallMethod falls back to Scoop on win32 path fragments", () => {
		const method = detectInstallMethod({
			execPath: "C:\\tools\\custom\\scoop\\dotenc.exe",
			argv: ["dotenc", "whoami"],
			platform: "win32",
			resolveRealPath: (input) => input,
		})
		expect(method).toBe("scoop")
	})

	test("detectInstallMethod handles realpath errors by using original paths", () => {
		const method = detectInstallMethod({
			execPath: "/opt/homebrew/Cellar/dotenc/0.5.0/bin/dotenc",
			argv: ["dotenc", "whoami"],
			resolveRealPath: () => {
				throw new Error("realpath failed")
			},
		})
		expect(method).toBe("homebrew")
	})

	test("compareVersions handles semantic versions", () => {
		expect(compareVersions("0.5.0", "0.4.9")).toBe(1)
		expect(compareVersions("0.5.0", "0.5.0")).toBe(0)
		expect(compareVersions("0.5.0", "0.5.1")).toBe(-1)
		expect(isVersionNewer("1.0.0", "0.9.9")).toBe(true)
	})

	test("compareVersions returns 0 for invalid versions", () => {
		expect(compareVersions("invalid", "0.5.1")).toBe(0)
		expect(compareVersions("0.5.x", "0.5.1")).toBe(0)
	})

	test("fetchLatestVersion returns latest semver when registry responds with version", async () => {
		const version = await fetchLatestVersion({
			fetchImpl: async () =>
				({
					ok: true,
					json: async () => ({ version: "0.9.0" }),
				}) as Response,
		})

		expect(version).toBe("0.9.0")
	})

	test("fetchLatestVersion returns null when registry response is not ok", async () => {
		const version = await fetchLatestVersion({
			fetchImpl: async () =>
				({
					ok: false,
					json: async () => ({ version: "0.9.0" }),
				}) as Response,
		})

		expect(version).toBeNull()
	})

	test("fetchLatestVersion returns null when payload has no valid version", async () => {
		const version = await fetchLatestVersion({
			fetchImpl: async () =>
				({
					ok: true,
					json: async () => ({ version: 10 }),
				}) as Response,
		})

		expect(version).toBeNull()
	})

	test("fetchLatestVersion returns null when fetch throws", async () => {
		const version = await fetchLatestVersion({
			fetchImpl: async () => {
				throw new Error("network down")
			},
		})

		expect(version).toBeNull()
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

	test("prints manual commands when install method is unknown", async () => {
		const runPackageManagerCommand = mock(async () => 0)
		const log = mock((_message: string) => {})

		await _runUpdateCommand({
			detectInstallMethod: () => "unknown",
			runPackageManagerCommand,
			log,
		})

		expect(runPackageManagerCommand).not.toHaveBeenCalled()
		expect(
			log.mock.calls.some((call) =>
				String(call[0]).includes("Could not determine installation method"),
			),
		).toBe(true)
		expect(
			log.mock.calls.some((call) =>
				String(call[0]).includes("npm install -g @dotenc/cli"),
			),
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

	test("exits with code 1 when updater command throws", async () => {
		const runPackageManagerCommand = mock(async () => {
			throw new Error("spawn ENOENT")
		})
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			_runUpdateCommand({
				detectInstallMethod: () => "homebrew",
				runPackageManagerCommand,
				log: mock((_message: string) => {}),
				logError,
				exit,
			}),
		).rejects.toThrow("exit(1)")

		expect(
			logError.mock.calls.some((call) =>
				String(call[0]).includes("failed to run"),
			),
		).toBe(true)
		expect(
			logError.mock.calls.some((call) => String(call[0]).includes("ENOENT")),
		).toBe(true)
	})
})

describe("_runPackageManagerCommand", () => {
	test("resolves with process exit code", async () => {
		const child = new EventEmitter()
		const spawnImpl = mock(() => {
			queueMicrotask(() => child.emit("exit", 0))
			return child as never
		})

		const code = await _runPackageManagerCommand(
			"npm",
			["--version"],
			spawnImpl as never,
		)
		expect(code).toBe(0)
	})

	test("rejects when the child process emits an error", async () => {
		const child = new EventEmitter()
		const spawnImpl = mock(() => {
			queueMicrotask(() => child.emit("error", new Error("spawn failed")))
			return child as never
		})

		await expect(
			_runPackageManagerCommand("npm", ["--version"], spawnImpl as never),
		).rejects.toThrow("spawn failed")
	})
})

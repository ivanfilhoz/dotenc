import { describe, expect, mock, test } from "bun:test"
import crypto from "node:crypto"
import path from "node:path"
import { _runInitCommand } from "../commands/init"

type RunInitDeps = NonNullable<Parameters<typeof _runInitCommand>[1]>

const createPrivateKeyEntry = () => {
	const { privateKey } = crypto.generateKeyPairSync("ed25519")
	return {
		name: "id_ed25519",
		privateKey,
		fingerprint: "test-fingerprint",
		algorithm: "ed25519" as const,
		rawPublicKey: Buffer.alloc(32),
	}
}

describe("initCommand", () => {
	test("exits when no name is provided", async () => {
		const keyAddCommand = mock(async () => {})
		const createCommand = mock(async () => {})

		const deps: RunInitDeps = {
			inputNamePrompt: mock(async () => "") as never,
			userInfo: () => ({ username: "tester" }) as never,
			choosePrivateKeyPrompt: mock(async () =>
				createPrivateKeyEntry(),
			) as never,
			createPublicKey: crypto.createPublicKey,
			keyAddCommand: keyAddCommand as never,
			setupGitDiff: () => {},
			existsSync: () => false,
			readFile: mock(async () => "") as never,
			unlink: mock(async () => {}) as never,
			cwd: () => "/workspace",
			createCommand: createCommand as never,
			logInfo: (_message: string) => {},
			logWarn: (_message: string) => {},
			logError: (_message: string) => {},
			resolveDocsUrl: () => undefined,
			exit: ((code: number): never => {
				throw new Error(`exit(${code})`)
			}) as never,
		}

		await expect(_runInitCommand({}, deps)).rejects.toThrow("exit(1)")
		expect(keyAddCommand).not.toHaveBeenCalled()
		expect(createCommand).not.toHaveBeenCalled()
	})

	test("exits when private key selection fails", async () => {
		const deps: RunInitDeps = {
			inputNamePrompt: mock(async () => "alice") as never,
			userInfo: () => ({ username: "tester" }) as never,
			choosePrivateKeyPrompt: mock(async () => {
				throw new Error("No private keys available")
			}) as never,
			createPublicKey: crypto.createPublicKey,
			keyAddCommand: mock(async () => {}) as never,
			setupGitDiff: () => {},
			existsSync: () => false,
			readFile: mock(async () => "") as never,
			unlink: mock(async () => {}) as never,
			cwd: () => "/workspace",
			createCommand: mock(async () => {}) as never,
			logInfo: (_message: string) => {},
			logWarn: (_message: string) => {},
			logError: (_message: string) => {},
			resolveDocsUrl: () => undefined,
			exit: ((code: number): never => {
				throw new Error(`exit(${code})`)
			}) as never,
		}

		await expect(_runInitCommand({}, deps)).rejects.toThrow("exit(1)")
	})

	test("migrates .env and creates development + personal environments", async () => {
		const logs: string[] = []
		const warns: string[] = []
		const createCommand = mock(
			async (_env: string, _key: string, _content?: string) => {},
		)
		const keyAddCommand = mock(async (_name: string, _options: unknown) => {})
		const unlink = mock(async (_path: string) => {})
		const readFile = mock(async () => "API_KEY=abc123\n")

		const deps: RunInitDeps = {
			inputNamePrompt: mock(async () => "ignored") as never,
			userInfo: () => ({ username: "tester" }) as never,
			choosePrivateKeyPrompt: mock(async () =>
				createPrivateKeyEntry(),
			) as never,
			createPublicKey: crypto.createPublicKey,
			keyAddCommand: keyAddCommand as never,
			setupGitDiff: () => {},
			existsSync: ((targetPath: unknown) =>
				String(targetPath) === path.join("/workspace", ".env") ||
				String(targetPath) === ".claude" ||
				String(targetPath) === ".vscode") as never,
			readFile: readFile as never,
			unlink: unlink as never,
			cwd: () => "/workspace",
			createCommand: createCommand as never,
			logInfo: (message) => logs.push(message),
			logWarn: (message) => warns.push(message),
			logError: (_message: string) => {},
			resolveDocsUrl: () => "https://example.com/docs",
			exit: ((code: number): never => {
				throw new Error(`exit(${code})`)
			}) as never,
		}

		await _runInitCommand({ name: "alice" }, deps)

		expect(keyAddCommand).toHaveBeenCalledTimes(1)
		expect(keyAddCommand.mock.calls[0]?.[0]).toBe("alice")
		expect(createCommand).toHaveBeenCalledTimes(2)
		expect(createCommand.mock.calls[0]).toEqual([
			"development",
			"alice",
			"API_KEY=abc123\n",
		])
		expect(createCommand.mock.calls[1]).toEqual(["alice", "alice"])
		expect(unlink).toHaveBeenCalledWith(path.join("/workspace", ".env"))
		expect(readFile).toHaveBeenCalledWith(
			path.join("/workspace", ".env"),
			"utf-8",
		)
		expect(warns).toHaveLength(0)
		expect(logs.some((line) => line.includes("Install the agent skill"))).toBe(
			true,
		)
		expect(logs.some((line) => line.includes("install-vscode-extension"))).toBe(
			true,
		)
		expect(logs.some((line) => line.includes("https://example.com/docs"))).toBe(
			true,
		)
	})

	test("continues when git diff setup fails and skips personal environment for development user", async () => {
		const warns: string[] = []
		const logs: string[] = []
		const createCommand = mock(
			async (_env: string, _key: string, _content?: string) => {},
		)

		const deps: RunInitDeps = {
			inputNamePrompt: mock(async () => "ignored") as never,
			userInfo: () => ({ username: "tester" }) as never,
			choosePrivateKeyPrompt: mock(async () =>
				createPrivateKeyEntry(),
			) as never,
			createPublicKey: crypto.createPublicKey,
			keyAddCommand: mock(async () => {}) as never,
			setupGitDiff: () => {
				throw new Error("not a git repository")
			},
			existsSync: () => false,
			readFile: mock(async () => "") as never,
			unlink: mock(async () => {}) as never,
			cwd: () => "/workspace",
			createCommand: createCommand as never,
			logInfo: (message) => logs.push(message),
			logWarn: (message) => warns.push(message),
			logError: (_message: string) => {},
			resolveDocsUrl: () => undefined,
			exit: ((code: number): never => {
				throw new Error(`exit(${code})`)
			}) as never,
		}

		await _runInitCommand({ name: "development" }, deps)

		expect(warns).toHaveLength(1)
		expect(warns[0]).toContain("could not set up git diff driver")
		expect(createCommand).toHaveBeenCalledTimes(1)
		expect(createCommand.mock.calls[0]).toEqual([
			"development",
			"development",
			undefined,
		])
		expect(
			logs.some((line) => line.includes("Edit your personal environment")),
		).toBe(false)
	})
})

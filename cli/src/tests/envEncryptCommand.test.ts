import { describe, expect, mock, test } from "bun:test"
import { encryptCommand } from "../commands/env/encrypt"

type EncryptCommandDeps = NonNullable<Parameters<typeof encryptCommand>[3]>

describe("env encrypt command", () => {
	test("returns JSON error when --stdin is not provided", async () => {
		const writeStdout = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			encryptEnvironment: async () => {},
			readStdin: async () => "",
			writeStdout,
			logError: (_message: string) => {},
			exit,
		}

		await expect(
			encryptCommand("development", { json: true }, undefined, deps),
		).rejects.toThrow("exit(1)")

		const [rawJson] = writeStdout.mock.calls[0]
		const parsed = JSON.parse(rawJson as string) as {
			ok: boolean
			error: { code: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("MISSING_STDIN")
	})

	test("encrypts content read from stdin", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const encryptEnvironmentMock = mock(
			async (_environment: string, _content: string) => {},
		)
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			encryptEnvironment: encryptEnvironmentMock,
			readStdin: async () => "API_KEY=abc123",
			writeStdout,
			logError,
			exit,
		}

		await encryptCommand("development", { stdin: true }, undefined, deps)

		expect(encryptEnvironmentMock).toHaveBeenCalledTimes(1)
		expect(encryptEnvironmentMock).toHaveBeenCalledWith(
			"development",
			"API_KEY=abc123",
		)
		expect(logError).not.toHaveBeenCalled()
		expect(writeStdout).not.toHaveBeenCalled()
		expect(exit).not.toHaveBeenCalled()
	})

	test("maps encryption errors in JSON mode", async () => {
		const writeStdout = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			encryptEnvironment: async () => {
				throw new Error("Environment file not found: /tmp/.env.production.enc")
			},
			readStdin: async () => "API_KEY=abc123",
			writeStdout,
			logError: (_message: string) => {},
			exit,
		}

		await expect(
			encryptCommand(
				"production",
				{ stdin: true, json: true },
				undefined,
				deps,
			),
		).rejects.toThrow("exit(1)")

		const [rawJson] = writeStdout.mock.calls[0]
		const parsed = JSON.parse(rawJson as string) as {
			ok: boolean
			error: { code: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("ENVIRONMENT_NOT_FOUND")
	})
})

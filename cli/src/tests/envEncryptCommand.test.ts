import { describe, expect, mock, test } from "bun:test"
import { encryptCommand } from "../commands/env/encrypt"

type EncryptCommandDeps = NonNullable<Parameters<typeof encryptCommand>[3]>

describe("env encrypt command", () => {
	test("logs plain error when environment name is invalid", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({
				valid: false,
				reason: "Invalid environment name: bad/name",
			}),
			encryptEnvironment: async () => {},
			readStdin: async () => "API_KEY=abc123",
			writeStdout,
			logError,
			exit,
		}

		await expect(
			encryptCommand("bad/name", {}, undefined, deps),
		).rejects.toThrow("exit(1)")

		expect(logError).toHaveBeenCalledWith("Invalid environment name: bad/name")
		expect(writeStdout).not.toHaveBeenCalled()
	})

	test("returns JSON error when environment name is invalid", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({
				valid: false,
				reason: "Invalid environment name: bad/name",
			}),
			encryptEnvironment: async () => {},
			readStdin: async () => "API_KEY=abc123",
			writeStdout,
			logError,
			exit,
		}

		await expect(
			encryptCommand("bad/name", { json: true }, undefined, deps),
		).rejects.toThrow("exit(1)")

		const [rawJson] = writeStdout.mock.calls[0]
		const parsed = JSON.parse(rawJson as string) as {
			ok: boolean
			error: { code: string; message: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("INVALID_ENVIRONMENT_NAME")
		expect(parsed.error.message).toBe("Invalid environment name: bad/name")
		expect(logError).not.toHaveBeenCalled()
	})

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

	test("logs plain error when --stdin is not provided", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			encryptEnvironment: async () => {},
			readStdin: async () => "",
			writeStdout,
			logError,
			exit,
		}

		await expect(
			encryptCommand("development", {}, undefined, deps),
		).rejects.toThrow("exit(1)")

		expect(logError).toHaveBeenCalledWith(
			'No input source provided. Use "--stdin" and pipe the plaintext content.',
		)
		expect(writeStdout).not.toHaveBeenCalled()
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

	test("returns JSON success and suppresses console noise", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const consoleLogSpy = mock((_message: string) => {})
		const consoleErrorSpy = mock((_message: string) => {})
		const originalLog = console.log
		const originalError = console.error
		console.log = consoleLogSpy as never
		console.error = consoleErrorSpy as never

		const encryptEnvironmentMock = mock(async () => {
			console.log("should-not-appear")
			console.error("should-not-appear")
		})

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

		try {
			await encryptCommand(
				"development",
				{ stdin: true, json: true },
				undefined,
				deps,
			)
		} finally {
			console.log = originalLog
			console.error = originalError
		}

		expect(encryptEnvironmentMock).toHaveBeenCalledTimes(1)
		expect(writeStdout).toHaveBeenCalledTimes(1)
		const [rawJson] = writeStdout.mock.calls[0]
		const parsed = JSON.parse(rawJson as string) as { ok: boolean }
		expect(parsed.ok).toBe(true)
		expect(logError).not.toHaveBeenCalled()
		expect(exit).not.toHaveBeenCalled()
		expect(consoleLogSpy).not.toHaveBeenCalled()
		expect(consoleErrorSpy).not.toHaveBeenCalled()
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

	test("maps access/no-key/passphrase/unknown encryption errors in JSON mode", async () => {
		const cases: Array<{ message: string; expectedCode: string }> = [
			{
				message: "Access denied to the environment.",
				expectedCode: "ACCESS_DENIED",
			},
			{
				message: "No private keys found in ~/.ssh",
				expectedCode: "NO_PRIVATE_KEYS",
			},
			{
				message: "No public keys found. Please add one.",
				expectedCode: "NO_PUBLIC_KEYS",
			},
			{
				message: "Found passphrase-protected key and cannot proceed.",
				expectedCode: "PASSPHRASE_PROTECTED_KEYS",
			},
			{
				message: "Something else exploded.",
				expectedCode: "UNKNOWN",
			},
		]

		for (const { message, expectedCode } of cases) {
			const writeStdout = mock((_output: string) => {})
			const exit = mock((code: number): never => {
				throw new Error(`exit(${code})`)
			})

			const deps: EncryptCommandDeps = {
				validateEnvironmentName: () => ({ valid: true }),
				encryptEnvironment: async () => {
					throw new Error(message)
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
			expect(parsed.error.code).toBe(expectedCode)
		}
	})

	test("strips ANSI codes before logging plain-text errors", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: EncryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			encryptEnvironment: async () => {
				throw new Error(
					`${String.fromCharCode(27)}[31mNo public keys found in project${String.fromCharCode(27)}[0m`,
				)
			},
			readStdin: async () => "API_KEY=abc123",
			writeStdout,
			logError,
			exit,
		}

		await expect(
			encryptCommand("development", { stdin: true }, undefined, deps),
		).rejects.toThrow("exit(1)")

		expect(logError).toHaveBeenCalledWith("No public keys found in project")
		expect(writeStdout).not.toHaveBeenCalled()
	})
})

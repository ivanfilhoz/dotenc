import { describe, expect, mock, test } from "bun:test"
import { decryptCommand } from "../commands/env/decrypt"

type DecryptCommandDeps = NonNullable<Parameters<typeof decryptCommand>[3]>

describe("env decrypt command", () => {
	test("prints plaintext on success", async () => {
		const writeStdout = mock((_message: string) => {})
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: DecryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			getEnvironmentByName: async () =>
				({
					keys: [],
					encryptedContent: "",
				}) as never,
			decryptEnvironmentData: async () => "API_KEY=abc123",
			writeStdout,
			logError,
			exit,
		}

		await decryptCommand("development", {}, undefined, deps)

		expect(writeStdout).toHaveBeenCalledTimes(1)
		expect(writeStdout).toHaveBeenCalledWith("API_KEY=abc123")
		expect(logError).not.toHaveBeenCalled()
		expect(exit).not.toHaveBeenCalled()
	})

	test("returns JSON error for invalid environment names", async () => {
		const writeStdout = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: DecryptCommandDeps = {
			validateEnvironmentName: () => ({
				valid: false,
				reason: "Environment name must not be empty.",
			}),
			getEnvironmentByName: async () => ({}) as never,
			decryptEnvironmentData: async () => "",
			writeStdout,
			logError: (_message: string) => {},
			exit,
		}

		await expect(
			decryptCommand("", { json: true }, undefined, deps),
		).rejects.toThrow("exit(1)")
		expect(writeStdout).toHaveBeenCalledTimes(1)

		const [rawJson] = writeStdout.mock.calls[0]
		const parsed = JSON.parse(rawJson as string) as {
			ok: boolean
			error: { code: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("INVALID_ENVIRONMENT_NAME")
	})

	test("maps access denied errors in JSON mode", async () => {
		const writeStdout = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: DecryptCommandDeps = {
			validateEnvironmentName: () => ({ valid: true }),
			getEnvironmentByName: async () =>
				({
					keys: [],
					encryptedContent: "",
				}) as never,
			decryptEnvironmentData: async () => {
				throw new Error("Access denied to the environment.")
			},
			writeStdout,
			logError: (_message: string) => {},
			exit,
		}

		await expect(
			decryptCommand("production", { json: true }, undefined, deps),
		).rejects.toThrow("exit(1)")

		const [rawJson] = writeStdout.mock.calls[0]
		const parsed = JSON.parse(rawJson as string) as {
			ok: boolean
			error: { code: string; message: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("ACCESS_DENIED")
		expect(parsed.error.message).toContain("Access denied")
	})
})

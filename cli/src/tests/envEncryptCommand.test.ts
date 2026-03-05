import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"

const validateEnvironmentName = mock((_name: string) => ({
	valid: true as boolean,
	reason: undefined as string | undefined,
}))
const encryptEnvironment = mock(async (_name: string, _content: string) => {})
const readStdin = mock(async () => "API_KEY=abc123")

mock.module("../helpers/validateEnvironmentName", () => ({
	validateEnvironmentName,
}))
mock.module("../helpers/encryptEnvironment", () => ({ encryptEnvironment }))
mock.module("../helpers/readStdin", () => ({ readStdin }))

const { encryptCommand } = await import("../commands/env/encrypt")

describe("env encrypt command", () => {
	beforeEach(() => {
		validateEnvironmentName.mockClear()
		encryptEnvironment.mockClear()
		readStdin.mockClear()
		validateEnvironmentName.mockImplementation(() => ({
			valid: true,
			reason: undefined,
		}))
		encryptEnvironment.mockImplementation(async () => {})
		readStdin.mockImplementation(async () => "API_KEY=abc123")
	})

	test("logs plain error when environment name is invalid", async () => {
		validateEnvironmentName.mockImplementation(() => ({
			valid: false,
			reason: "Invalid environment name: bad/name",
		}))

		const errSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(encryptCommand("bad/name", {})).rejects.toThrow("exit(1)")

		expect(errSpy).toHaveBeenCalledWith("Invalid environment name: bad/name")
		errSpy.mockRestore()
		exitSpy.mockRestore()
	})

	test("returns JSON error when environment name is invalid", async () => {
		validateEnvironmentName.mockImplementation(() => ({
			valid: false,
			reason: "Invalid environment name: bad/name",
		}))

		const writeSpy = spyOn(process.stdout, "write").mockImplementation(
			() => true,
		)
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(encryptCommand("bad/name", { json: true })).rejects.toThrow(
			"exit(1)",
		)

		const [rawJson] = writeSpy.mock.calls[0] as [string]
		const parsed = JSON.parse(rawJson) as {
			ok: boolean
			error: { code: string; message: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("INVALID_ENVIRONMENT_NAME")
		expect(parsed.error.message).toBe("Invalid environment name: bad/name")
		writeSpy.mockRestore()
		exitSpy.mockRestore()
	})

	test("returns JSON error when --stdin is not provided", async () => {
		const writeSpy = spyOn(process.stdout, "write").mockImplementation(
			() => true,
		)
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(encryptCommand("development", { json: true })).rejects.toThrow(
			"exit(1)",
		)

		const [rawJson] = writeSpy.mock.calls[0] as [string]
		const parsed = JSON.parse(rawJson) as {
			ok: boolean
			error: { code: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("MISSING_STDIN")
		writeSpy.mockRestore()
		exitSpy.mockRestore()
	})

	test("logs plain error when --stdin is not provided", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(encryptCommand("development", {})).rejects.toThrow("exit(1)")

		expect(errSpy).toHaveBeenCalledWith(
			'No input source provided. Use "--stdin" and pipe the plaintext content.',
		)
		errSpy.mockRestore()
		exitSpy.mockRestore()
	})

	test("encrypts content read from stdin", async () => {
		const errSpy = spyOn(console, "error").mockImplementation(() => {})
		const writeSpy = spyOn(process.stdout, "write").mockImplementation(
			() => true,
		)

		await encryptCommand("development", { stdin: true })

		expect(encryptEnvironment).toHaveBeenCalledWith(
			"development",
			"API_KEY=abc123",
		)
		expect(errSpy).not.toHaveBeenCalled()
		expect(writeSpy).not.toHaveBeenCalled()
		errSpy.mockRestore()
		writeSpy.mockRestore()
	})

	test("returns JSON success and suppresses console noise", async () => {
		const writeSpy = spyOn(process.stdout, "write").mockImplementation(
			() => true,
		)
		const logSpy = spyOn(console, "log").mockImplementation(() => {})
		const errSpy = spyOn(console, "error").mockImplementation(() => {})

		encryptEnvironment.mockImplementation(async () => {
			console.log("should-not-appear")
			console.error("should-not-appear")
		})

		await encryptCommand("development", { stdin: true, json: true })

		expect(encryptEnvironment).toHaveBeenCalledTimes(1)
		expect(writeSpy).toHaveBeenCalledTimes(1)
		const [rawJson] = writeSpy.mock.calls[0] as [string]
		expect(JSON.parse(rawJson)).toEqual({ ok: true })
		expect(logSpy).not.toHaveBeenCalled()
		expect(errSpy).not.toHaveBeenCalled()
		writeSpy.mockRestore()
		logSpy.mockRestore()
		errSpy.mockRestore()
	})

	test("maps encryption errors in JSON mode", async () => {
		encryptEnvironment.mockImplementation(async () => {
			throw new Error("Environment file not found: /tmp/.env.production.enc")
		})

		const writeSpy = spyOn(process.stdout, "write").mockImplementation(
			() => true,
		)
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			encryptCommand("production", { stdin: true, json: true }),
		).rejects.toThrow("exit(1)")

		const [rawJson] = writeSpy.mock.calls[0] as [string]
		const parsed = JSON.parse(rawJson) as {
			ok: boolean
			error: { code: string }
		}

		expect(parsed.ok).toBe(false)
		expect(parsed.error.code).toBe("ENVIRONMENT_NOT_FOUND")
		writeSpy.mockRestore()
		exitSpy.mockRestore()
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
			{ message: "Something else exploded.", expectedCode: "UNKNOWN" },
		]

		for (const { message, expectedCode } of cases) {
			encryptEnvironment.mockImplementation(async () => {
				throw new Error(message)
			})

			const writeSpy = spyOn(process.stdout, "write").mockImplementation(
				() => true,
			)
			const exitSpy = spyOn(process, "exit").mockImplementation(
				(code): never => {
					throw new Error(`exit(${code})`)
				},
			)

			await expect(
				encryptCommand("production", { stdin: true, json: true }),
			).rejects.toThrow("exit(1)")

			const [rawJson] = writeSpy.mock.calls[0] as [string]
			const parsed = JSON.parse(rawJson) as {
				ok: boolean
				error: { code: string }
			}

			expect(parsed.ok).toBe(false)
			expect(parsed.error.code).toBe(expectedCode)
			writeSpy.mockRestore()
			exitSpy.mockRestore()
		}
	})

	test("strips ANSI codes before logging plain-text errors", async () => {
		encryptEnvironment.mockImplementation(async () => {
			throw new Error(
				`${String.fromCharCode(27)}[31mNo public keys found in project${String.fromCharCode(27)}[0m`,
			)
		})

		const errSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			encryptCommand("development", { stdin: true }),
		).rejects.toThrow("exit(1)")

		expect(errSpy).toHaveBeenCalledWith("No public keys found in project")
		errSpy.mockRestore()
		exitSpy.mockRestore()
	})
})

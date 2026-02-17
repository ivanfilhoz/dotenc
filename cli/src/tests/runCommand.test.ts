import { describe, expect, mock, test } from "bun:test"
import { runCommand } from "../commands/run"

type RunCommandDeps = NonNullable<Parameters<typeof runCommand>[4]>

describe("runCommand", () => {
	test("exits when no environment is provided", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: RunCommandDeps = {
			decryptEnvironment: async () => "",
			parseEnv: () => ({}),
			validateEnvironmentName: () => ({ valid: true }),
			spawn: (() => {
				throw new Error("spawn should not be called")
			}) as never,
			logError,
			exit,
		}

		await expect(
			runCommand("echo", ["ok"], {}, undefined, deps),
		).rejects.toThrow("exit(1)")
		expect(logError).toHaveBeenCalledTimes(1)
		expect(String(logError.mock.calls[0][0])).toContain(
			"No environment provided",
		)
		expect(exit).toHaveBeenCalledWith(1)
	})

	test("exits when environment name is invalid", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: RunCommandDeps = {
			decryptEnvironment: async () => "",
			parseEnv: () => ({}),
			validateEnvironmentName: () => ({
				valid: false,
				reason: "Invalid environment name: contains spaces.",
			}),
			spawn: (() => {
				throw new Error("spawn should not be called")
			}) as never,
			logError,
			exit,
		}

		await expect(
			runCommand("echo", ["ok"], { env: "bad env" }, undefined, deps),
		).rejects.toThrow("exit(1)")
		expect(String(logError.mock.calls[0][0])).toContain(
			"Invalid environment name",
		)
		expect(exit).toHaveBeenCalledWith(1)
	})

	test("uses DOTENC_ENV fallback and spawns with decrypted env", async () => {
		const originalDotenvEnv = process.env.DOTENC_ENV
		try {
			process.env.DOTENC_ENV = "staging"

			const logError = mock((_message: string) => {})
			const exit = mock((_code: number): never => undefined as never)
			const decryptEnvironment = mock(async () => "API_KEY=abc123")
			const parseEnv = mock(() => ({ API_KEY: "abc123" }))

			let capturedEnv: NodeJS.ProcessEnv | undefined
			let exitHandler: ((code: number | null) => void) | undefined

			const spawn = mock(
				(
					_command: string,
					_args: string[],
					options: { env: NodeJS.ProcessEnv },
				) => {
					capturedEnv = options.env
					const child = {
						on: (event: string, cb: (code: number | null) => void) => {
							if (event === "exit") exitHandler = cb
							return child
						},
					}
					return child as never
				},
			)

			const deps: RunCommandDeps = {
				decryptEnvironment,
				parseEnv,
				validateEnvironmentName: () => ({ valid: true }),
				spawn: spawn as never,
				logError,
				exit,
			}

			await runCommand("node", ["app.js"], {}, undefined, deps)

			expect(decryptEnvironment).toHaveBeenCalledWith("staging")
			expect(parseEnv).toHaveBeenCalledWith("API_KEY=abc123")
			expect(capturedEnv?.API_KEY).toBe("abc123")
			expect(logError).not.toHaveBeenCalled()

			if (!exitHandler)
				throw new Error("Expected exit handler to be registered")
			exitHandler(7)
			expect(exit).toHaveBeenCalledWith(7)
		} finally {
			if (originalDotenvEnv) process.env.DOTENC_ENV = originalDotenvEnv
			else delete process.env.DOTENC_ENV
		}
	})

	test("warns when some environments fail but still runs command", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((_code: number): never => undefined as never)

		const decryptEnvironment = mock(async (name: string) => {
			if (name === "development")
				throw new Error("failed to decrypt development")
			return "PERSONAL_SECRET=personal456"
		})

		const spawn = mock(() => {
			const child = {
				on: (_event: string, _cb: (code: number | null) => void) => child,
			}
			return child as never
		})

		const deps: RunCommandDeps = {
			decryptEnvironment,
			parseEnv: () => ({ PERSONAL_SECRET: "personal456" }),
			validateEnvironmentName: () => ({ valid: true }),
			spawn: spawn as never,
			logError,
			exit,
		}

		await runCommand(
			"sh",
			["-c", "echo ok"],
			{ env: "development,alice" },
			undefined,
			deps,
		)

		const logMessages = logError.mock.calls.map((c) => String(c[0]))
		expect(
			logMessages.some((m) => m.includes("failed to decrypt development")),
		).toBe(true)
		expect(
			logMessages.some((m) =>
				m.includes("1 of 2 environment(s) failed to load"),
			),
		).toBe(true)
		expect(spawn).toHaveBeenCalledTimes(1)
	})

	test("exits when all environments fail and reports unknown errors", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const decryptEnvironment = mock(async (name: string) => {
			if (name === "development") throw "boom"
			throw new Error("failed to decrypt alice")
		})

		const deps: RunCommandDeps = {
			decryptEnvironment,
			parseEnv: () => ({}),
			validateEnvironmentName: () => ({ valid: true }),
			spawn: (() => {
				throw new Error("spawn should not be called")
			}) as never,
			logError,
			exit,
		}

		await expect(
			runCommand(
				"sh",
				["-c", "echo ok"],
				{ env: "development,alice" },
				undefined,
				deps,
			),
		).rejects.toThrow("exit(1)")

		const logMessages = logError.mock.calls.map((c) => String(c[0]))
		expect(
			logMessages.some((m) =>
				m.includes(
					"Unknown error occurred while decrypting the environment development",
				),
			),
		).toBe(true)
		expect(logMessages.some((m) => m.includes("failed to decrypt alice"))).toBe(
			true,
		)
		expect(
			logMessages.some((m) => m.includes("All environments failed to load")),
		).toBe(true)
	})
})

import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import { runCommand } from "../commands/run"

type RunCommandDeps = NonNullable<Parameters<typeof runCommand>[4]>

const ROOT = "/workspace"
const SUBDIR = path.join(ROOT, "packages", "web")

const makeBaseDeps = (
	overrides: Partial<RunCommandDeps> = {},
): RunCommandDeps => ({
	decryptEnvironmentData: async () => "KEY=value",
	getEnvironmentByPath: async () => ({
		version: 2 as const,
		keys: [],
		encryptedContent: "",
	}),
	buildAncestorChain: (_root, _inv) => [ROOT],
	resolveProjectRoot: () => ROOT,
	parseEnv: () => ({ KEY: "value" }),
	validateEnvironmentName: () => ({ valid: true }),
	spawn: (() => {
		throw new Error("spawn should not be called")
	}) as never,
	existsSync: () => false,
	cwd: () => ROOT,
	logError: mock((_msg: string) => {}),
	exit: mock((code: number): never => {
		throw new Error(`exit(${code})`)
	}),
	...overrides,
})

describe("runCommand", () => {
	test("exits when no environment is provided", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			runCommand(
				"echo",
				["ok"],
				{},
				undefined,
				makeBaseDeps({ logError, exit }),
			),
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

		await expect(
			runCommand(
				"echo",
				["ok"],
				{ env: "bad env" },
				undefined,
				makeBaseDeps({
					validateEnvironmentName: () => ({
						valid: false,
						reason: "Invalid environment name: contains spaces.",
					}),
					logError,
					exit,
				}),
			),
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

			const filePath = path.join(ROOT, ".env.staging.enc")
			await runCommand(
				"node",
				["app.js"],
				{},
				undefined,
				makeBaseDeps({
					decryptEnvironmentData: async () => "API_KEY=abc123",
					existsSync: (p) => p === filePath,
					parseEnv,
					spawn: spawn as never,
					logError,
					exit,
				}),
			)

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

		const stagingFile = path.join(ROOT, ".env.staging.enc")
		const aliceFile = path.join(ROOT, ".env.alice.enc")

		const spawn = mock(() => {
			const child = {
				on: (_event: string, _cb: (code: number | null) => void) => child,
			}
			return child as never
		})

		await runCommand(
			"sh",
			["-c", "echo ok"],
			{ env: "staging,alice" },
			undefined,
			makeBaseDeps({
				decryptEnvironmentData: async (name) => {
					if (name === "staging") throw new Error("failed to decrypt staging")
					return "PERSONAL_SECRET=personal456"
				},
				existsSync: (p) => p === stagingFile || p === aliceFile,
				parseEnv: () => ({ PERSONAL_SECRET: "personal456" }),
				spawn: spawn as never,
				logError,
				exit,
			}),
		)

		const logMessages = logError.mock.calls.map((c) => String(c[0]))
		expect(
			logMessages.some((m) => m.includes("failed to decrypt staging")),
		).toBe(true)
		expect(
			logMessages.some((m) =>
				m.includes("1 of 2 environment(s) failed to load"),
			),
		).toBe(true)
		expect(spawn).toHaveBeenCalledTimes(1)
	})

	test("exits when strict mode is enabled and any environment fails", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const stagingFile = path.join(ROOT, ".env.staging.enc")
		const aliceFile = path.join(ROOT, ".env.alice.enc")

		await expect(
			runCommand(
				"sh",
				["-c", "echo ok"],
				{ env: "staging,alice", strict: true },
				undefined,
				makeBaseDeps({
					decryptEnvironmentData: async (name) => {
						if (name === "staging") throw new Error("failed to decrypt staging")
						return "PERSONAL_SECRET=personal456"
					},
					existsSync: (p) => p === stagingFile || p === aliceFile,
					logError,
					exit,
				}),
			),
		).rejects.toThrow("exit(1)")

		const logMessages = logError.mock.calls.map((c) => String(c[0]))
		expect(logMessages.some((m) => m.includes("strict mode is enabled"))).toBe(
			true,
		)
	})

	test("does not pass DOTENC_PRIVATE_KEY to child process", async () => {
		const originalKey = process.env.DOTENC_PRIVATE_KEY
		try {
			process.env.DOTENC_PRIVATE_KEY = "super-secret-key"

			let capturedEnv: NodeJS.ProcessEnv | undefined
			const spawn = mock(
				(
					_command: string,
					_args: string[],
					options: { env: NodeJS.ProcessEnv },
				) => {
					capturedEnv = options.env
					const child = {
						on: (_event: string, _cb: (code: number | null) => void) => child,
					}
					return child as never
				},
			)

			const filePath = path.join(ROOT, ".env.production.enc")
			await runCommand(
				"node",
				["app.js"],
				{ env: "production" },
				undefined,
				makeBaseDeps({
					decryptEnvironmentData: async () => "KEY=value",
					existsSync: (p) => p === filePath,
					parseEnv: () => ({ KEY: "value" }),
					spawn: spawn as never,
					exit: mock((_code: number): never => undefined as never),
				}),
			)

			expect(capturedEnv).toBeDefined()
			expect(capturedEnv?.DOTENC_PRIVATE_KEY).toBeUndefined()
			expect(capturedEnv?.KEY).toBe("value")
		} finally {
			if (originalKey === undefined) delete process.env.DOTENC_PRIVATE_KEY
			else process.env.DOTENC_PRIVATE_KEY = originalKey
		}
	})

	test("exits when all environments fail and reports unknown errors", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const stagingFile = path.join(ROOT, ".env.staging.enc")
		const aliceFile = path.join(ROOT, ".env.alice.enc")

		await expect(
			runCommand(
				"sh",
				["-c", "echo ok"],
				{ env: "staging,alice" },
				undefined,
				makeBaseDeps({
					decryptEnvironmentData: async (name) => {
						if (name === "staging") throw "boom"
						throw new Error("failed to decrypt alice")
					},
					existsSync: (p) => p === stagingFile || p === aliceFile,
					logError,
					exit,
				}),
			),
		).rejects.toThrow("exit(1)")

		const logMessages = logError.mock.calls.map((c) => String(c[0]))
		expect(
			logMessages.some((m) =>
				m.includes(
					"Unknown error occurred while decrypting the environment staging",
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

	test("treats missing env file at all levels as a failure", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		// existsSync always returns false → env file not found anywhere
		await expect(
			runCommand(
				"echo",
				["ok"],
				{ env: "nonexistent" },
				undefined,
				makeBaseDeps({ logError, exit }),
			),
		).rejects.toThrow("exit(1)")

		const messages = logError.mock.calls.map((c) => String(c[0]))
		expect(messages.some((m) => m.includes("nonexistent"))).toBe(true)
		expect(messages.some((m) => m.includes("All environments failed"))).toBe(
			true,
		)
	})

	test("exits when resolveProjectRoot fails (not in a project)", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		await expect(
			runCommand(
				"echo",
				["ok"],
				{ env: "staging" },
				undefined,
				makeBaseDeps({
					resolveProjectRoot: () => {
						throw new Error(
							'Not in a dotenc project. Run "dotenc init" to initialize.',
						)
					},
					logError,
					exit,
				}),
			),
		).rejects.toThrow("exit(1)")

		expect(String(logError.mock.calls[0]?.[0])).toContain(
			"Not in a dotenc project",
		)
	})

	test("--local-only skips ancestor dirs and only uses cwd", async () => {
		const cwd = SUBDIR
		const rootFile = path.join(ROOT, ".env.staging.enc")
		const localFile = path.join(cwd, ".env.staging.enc")

		const decryptCalls: string[] = []
		const spawn = mock(() => {
			const child = {
				on: (_event: string, _cb: (code: number | null) => void) => child,
			}
			return child as never
		})

		await runCommand(
			"echo",
			["ok"],
			{ env: "staging", localOnly: true },
			undefined,
			makeBaseDeps({
				cwd: () => cwd,
				buildAncestorChain: () => [ROOT, cwd],
				decryptEnvironmentData: async (name) => {
					decryptCalls.push(name)
					return "VALUE=local"
				},
				existsSync: (p) => p === rootFile || p === localFile,
				parseEnv: () => ({ VALUE: "local" }),
				spawn: spawn as never,
				exit: mock((_code: number): never => undefined as never),
				logError: mock(() => {}),
			}),
		)

		// With localOnly=true: only cwd is in dirs=[cwd], so only localFile is checked
		expect(decryptCalls).toHaveLength(1)
		expect(spawn).toHaveBeenCalledTimes(1)
	})

	test("loads from ancestor chain with deeper level overriding root", async () => {
		const cwd = SUBDIR
		const rootFile = path.join(ROOT, ".env.staging.enc")
		const localFile = path.join(cwd, ".env.staging.enc")

		let capturedEnv: NodeJS.ProcessEnv | undefined
		const spawn = mock(
			(
				_command: string,
				_args: string[],
				options: { env: NodeJS.ProcessEnv },
			) => {
				capturedEnv = options.env
				const child = {
					on: (_event: string, _cb: (code: number | null) => void) => child,
				}
				return child as never
			},
		)

		await runCommand(
			"echo",
			["ok"],
			{ env: "staging" },
			undefined,
			makeBaseDeps({
				cwd: () => cwd,
				resolveProjectRoot: () => ROOT,
				buildAncestorChain: () => [ROOT, cwd],
				getEnvironmentByPath: async (fp) => ({
					version: 2 as const,
					keys: [],
					encryptedContent: fp, // store the path so we can distinguish
				}),
				decryptEnvironmentData: async (_name, env) => {
					const fp = (env as { encryptedContent: string }).encryptedContent
					if (fp === rootFile) return "VALUE=root\nSHARED=root"
					return "VALUE=local\nEXTRA=extra"
				},
				existsSync: (p) => p === rootFile || p === localFile,
				parseEnv: (content) => {
					const result: Record<string, string> = {}
					for (const line of content.split("\n")) {
						const [k, v] = line.split("=")
						if (k && v !== undefined) result[k] = v
					}
					return result
				},
				spawn: spawn as never,
				exit: mock((_code: number): never => undefined as never),
				logError: mock(() => {}),
			}),
		)

		// local (deeper) wins over root — VALUE should be "local"
		expect(capturedEnv?.VALUE).toBe("local")
		// root-only key is still present
		expect(capturedEnv?.SHARED).toBe("root")
		// local-only key is present
		expect(capturedEnv?.EXTRA).toBe("extra")
	})
})

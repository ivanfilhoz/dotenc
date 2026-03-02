import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import type { AuthPurgeCommandDeps } from "../commands/auth/purge"
import { authPurgeCommand } from "../commands/auth/purge"

const CWD = "/tmp/dotenc-purge-test"

const createDeps = (
	overrides: Partial<AuthPurgeCommandDeps> = {},
): {
	deps: AuthPurgeCommandDeps
	log: ReturnType<typeof mock>
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	confirmPrompt: ReturnType<typeof mock>
	getEnvironments: ReturnType<typeof mock>
	getEnvironmentByName: ReturnType<typeof mock>
	decryptEnvironment: ReturnType<typeof mock>
	encryptEnvironment: ReturnType<typeof mock>
	unlink: ReturnType<typeof mock>
} => {
	const log = mock((_msg: string) => {})
	const logError = mock((_msg: string) => {})
	const exit = mock((code: number): never => {
		throw new Error(`exit(${code})`)
	})
	const confirmPrompt = mock(async () => true)
	const getEnvironments = mock(async () => ["staging", "production"])
	const getEnvironmentByName = mock(async (_name: string) => ({
		keys: [{ name: "bob" }, { name: "alice" }],
	}))
	const decryptEnvironment = mock(async (_name: string) => "SECRET=1")
	const encryptEnvironment = mock(
		async (_name: string, _content: string, _options?: object) => {},
	)
	const unlink = mock(async (_filePath: string) => {})

	const deps: AuthPurgeCommandDeps = {
		getEnvironments:
			getEnvironments as unknown as AuthPurgeCommandDeps["getEnvironments"],
		getEnvironmentByName:
			getEnvironmentByName as unknown as AuthPurgeCommandDeps["getEnvironmentByName"],
		decryptEnvironment:
			decryptEnvironment as unknown as AuthPurgeCommandDeps["decryptEnvironment"],
		encryptEnvironment:
			encryptEnvironment as unknown as AuthPurgeCommandDeps["encryptEnvironment"],
		validateKeyName: ((name: string) =>
			name.startsWith("../")
				? { valid: false, reason: "invalid key name" }
				: { valid: true }) as AuthPurgeCommandDeps["validateKeyName"],
		confirmPrompt:
			confirmPrompt as unknown as AuthPurgeCommandDeps["confirmPrompt"],
		existsSync: (() => true) as AuthPurgeCommandDeps["existsSync"],
		unlink: unlink as unknown as AuthPurgeCommandDeps["unlink"],
		cwd: () => CWD,
		log,
		logError,
		exit,
		...overrides,
	}

	return {
		deps,
		log,
		logError,
		exit,
		confirmPrompt,
		getEnvironments,
		getEnvironmentByName,
		decryptEnvironment,
		encryptEnvironment,
		unlink,
	}
}

describe("authPurgeCommand", () => {
	test("rejects invalid key names", async () => {
		const { deps, logError, exit } = createDeps()

		await expect(authPurgeCommand("../evil", false, deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(String(logError.mock.calls[0]?.[0])).toContain("invalid key name")
	})

	test("exits when key file does not exist", async () => {
		const { deps, logError, exit } = createDeps({
			existsSync: (() => false) as AuthPurgeCommandDeps["existsSync"],
		})

		await expect(authPurgeCommand("bob", false, deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(String(logError.mock.calls[0]?.[0])).toContain("not found")
	})

	test("proceeds with no environments — just removes key file", async () => {
		const { deps, log, unlink } = createDeps({
			getEnvironments: mock(
				async () => [],
			) as unknown as AuthPurgeCommandDeps["getEnvironments"],
		})

		await authPurgeCommand("bob", true, deps)

		expect(unlink).toHaveBeenCalledWith(path.join(CWD, ".dotenc", "bob.pub"))
		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("Offboarding complete"))).toBe(true)
	})

	test("revokes and rotates all affected environments, then removes key", async () => {
		const { deps, unlink, decryptEnvironment, encryptEnvironment } =
			createDeps()

		await authPurgeCommand("bob", true, deps)

		expect(decryptEnvironment).toHaveBeenCalledWith("staging")
		expect(decryptEnvironment).toHaveBeenCalledWith("production")
		expect(encryptEnvironment).toHaveBeenCalledWith("staging", "SECRET=1", {
			revokePublicKeys: ["bob"],
		})
		expect(encryptEnvironment).toHaveBeenCalledWith("production", "SECRET=1", {
			revokePublicKeys: ["bob"],
		})
		expect(unlink).toHaveBeenCalledWith(path.join(CWD, ".dotenc", "bob.pub"))
	})

	test("skips environments with per-file errors and reports failures in summary", async () => {
		const { deps, log, logError, unlink } = createDeps({
			decryptEnvironment: mock(async (name: string) => {
				if (name === "staging") throw new Error("decrypt failed")
				return "SECRET=1"
			}) as unknown as AuthPurgeCommandDeps["decryptEnvironment"],
		})

		await authPurgeCommand("bob", true, deps)

		// Key still deleted (best-effort)
		expect(unlink).toHaveBeenCalledTimes(1)

		// Summary mentions failure
		const allLogged = [
			...log.mock.calls.map((c) => String(c[0])),
			...logError.mock.calls.map((c) => String(c[0])),
		]
		expect(
			allLogged.some((m) => m.includes("1 failed") || m.includes("staging")),
		).toBe(true)
	})

	test("treats environment with zero remaining recipients as a file-level error", async () => {
		const { deps, log, encryptEnvironment } = createDeps({
			getEnvironmentByName: mock(async (_name: string) => ({
				keys: [{ name: "bob" }], // bob is the only key
			})) as unknown as AuthPurgeCommandDeps["getEnvironmentByName"],
		})

		await authPurgeCommand("bob", true, deps)

		// Should not encrypt (skipped)
		expect(encryptEnvironment).not.toHaveBeenCalled()

		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(
			logged.some((m) => m.includes("skipped") || m.includes("zero recipient")),
		).toBe(true)
	})

	test("aborts when user declines confirmation", async () => {
		const declineConfirmPrompt = mock(async () => false)
		const { deps, unlink } = createDeps({
			confirmPrompt:
				declineConfirmPrompt as unknown as AuthPurgeCommandDeps["confirmPrompt"],
		})

		await authPurgeCommand("bob", false, deps)

		expect(declineConfirmPrompt).toHaveBeenCalledTimes(1)
		expect(unlink).not.toHaveBeenCalled()
	})

	test("skips confirmation when yes=true", async () => {
		const { deps, confirmPrompt } = createDeps()

		await authPurgeCommand("bob", true, deps)

		expect(confirmPrompt).not.toHaveBeenCalled()
	})

	test("removes key file even when some environments fail (best-effort)", async () => {
		const { deps, unlink } = createDeps({
			encryptEnvironment: mock(async () => {
				throw new Error("encrypt failed")
			}) as unknown as AuthPurgeCommandDeps["encryptEnvironment"],
		})

		await authPurgeCommand("bob", true, deps)

		expect(unlink).toHaveBeenCalledWith(path.join(CWD, ".dotenc", "bob.pub"))
	})
})

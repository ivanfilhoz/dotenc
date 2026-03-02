import { describe, expect, mock, test } from "bun:test"
import type { EnvRotateAllCommandDeps } from "../commands/env/rotate-all"
import { envRotateAllCommand } from "../commands/env/rotate-all"

const createDeps = (
	overrides: Partial<EnvRotateAllCommandDeps> = {},
): {
	deps: EnvRotateAllCommandDeps
	log: ReturnType<typeof mock>
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	confirmPrompt: ReturnType<typeof mock>
	getEnvironments: ReturnType<typeof mock>
	decryptEnvironment: ReturnType<typeof mock>
	encryptEnvironment: ReturnType<typeof mock>
} => {
	const log = mock((_msg: string) => {})
	const logError = mock((_msg: string) => {})
	const exit = mock((code: number): never => {
		throw new Error(`exit(${code})`)
	})
	const confirmPrompt = mock(async () => true)
	const getEnvironments = mock(async () => ["staging", "production"])
	const decryptEnvironment = mock(async (_name: string) => "A=1")
	const encryptEnvironment = mock(async (_name: string, _content: string) => {})

	const deps: EnvRotateAllCommandDeps = {
		getEnvironments:
			getEnvironments as unknown as EnvRotateAllCommandDeps["getEnvironments"],
		decryptEnvironment:
			decryptEnvironment as unknown as EnvRotateAllCommandDeps["decryptEnvironment"],
		encryptEnvironment:
			encryptEnvironment as unknown as EnvRotateAllCommandDeps["encryptEnvironment"],
		confirmPrompt:
			confirmPrompt as unknown as EnvRotateAllCommandDeps["confirmPrompt"],
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
		decryptEnvironment,
		encryptEnvironment,
	}
}

describe("envRotateAllCommand", () => {
	test("prints 'No environments found' when list is empty", async () => {
		const { deps, log, decryptEnvironment } = createDeps({
			getEnvironments: mock(
				async () => [],
			) as unknown as EnvRotateAllCommandDeps["getEnvironments"],
		})

		await envRotateAllCommand(true, deps)

		expect(decryptEnvironment).not.toHaveBeenCalled()
		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("No environments found"))).toBe(true)
	})

	test("rotates all environments when confirmed", async () => {
		const { deps, decryptEnvironment, encryptEnvironment } = createDeps()

		await envRotateAllCommand(true, deps)

		expect(decryptEnvironment).toHaveBeenCalledWith("staging")
		expect(decryptEnvironment).toHaveBeenCalledWith("production")
		expect(encryptEnvironment).toHaveBeenCalledWith("staging", "A=1")
		expect(encryptEnvironment).toHaveBeenCalledWith("production", "A=1")
	})

	test("aborts when user declines", async () => {
		const { deps, encryptEnvironment } = createDeps({
			confirmPrompt: mock(
				async () => false,
			) as unknown as EnvRotateAllCommandDeps["confirmPrompt"],
		})

		await envRotateAllCommand(false, deps)

		expect(encryptEnvironment).not.toHaveBeenCalled()
	})

	test("skips confirmation when yes=true", async () => {
		const { deps, confirmPrompt } = createDeps()

		await envRotateAllCommand(true, deps)

		expect(confirmPrompt).not.toHaveBeenCalled()
	})

	test("reports per-file errors but continues (best-effort)", async () => {
		const { deps, logError, encryptEnvironment } = createDeps({
			decryptEnvironment: mock(async (name: string) => {
				if (name === "staging") throw new Error("decrypt failed")
				return "A=1"
			}) as unknown as EnvRotateAllCommandDeps["decryptEnvironment"],
		})

		await envRotateAllCommand(true, deps)

		// production should still be encrypted despite staging failure
		expect(encryptEnvironment).toHaveBeenCalledWith("production", "A=1")
		// staging error reported
		const errors = logError.mock.calls.map((c) => String(c[0]))
		expect(errors.some((m) => m.includes("staging"))).toBe(true)
	})

	test("prints per-file success/failure summary", async () => {
		const { deps, log, logError } = createDeps({
			encryptEnvironment: mock(async (name: string) => {
				if (name === "production") throw new Error("encrypt failed")
			}) as unknown as EnvRotateAllCommandDeps["encryptEnvironment"],
		})

		await envRotateAllCommand(true, deps)

		const logged = log.mock.calls.map((c) => String(c[0]))
		const errors = logError.mock.calls.map((c) => String(c[0]))

		// staging succeeds
		expect(logged.some((m) => m.includes("staging"))).toBe(true)
		// production fails
		expect(errors.some((m) => m.includes("production"))).toBe(true)
	})
})

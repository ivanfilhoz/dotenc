import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import type { EnvDeleteCommandDeps } from "../commands/env/delete"
import { envDeleteCommand } from "../commands/env/delete"

const CWD = "/tmp/dotenc-env-delete-test"

const createDeps = (
	overrides: Partial<EnvDeleteCommandDeps> = {},
): {
	deps: EnvDeleteCommandDeps
	log: ReturnType<typeof mock>
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	confirmPrompt: ReturnType<typeof mock>
	chooseEnvironmentPrompt: ReturnType<typeof mock>
	unlink: ReturnType<typeof mock>
} => {
	const log = mock((_msg: string) => {})
	const logError = mock((_msg: string) => {})
	const exit = mock((code: number): never => {
		throw new Error(`exit(${code})`)
	})
	const confirmPrompt = mock(async () => true)
	const chooseEnvironmentPrompt = mock(async () => "staging")
	const unlink = mock(async (_filePath: string) => {})

	const deps: EnvDeleteCommandDeps = {
		validateEnvironmentName: ((name: string) =>
			name === "invalid!!"
				? { valid: false, reason: "invalid environment name" }
				: { valid: true }) as EnvDeleteCommandDeps["validateEnvironmentName"],
		chooseEnvironmentPrompt:
			chooseEnvironmentPrompt as unknown as EnvDeleteCommandDeps["chooseEnvironmentPrompt"],
		confirmPrompt:
			confirmPrompt as unknown as EnvDeleteCommandDeps["confirmPrompt"],
		existsSync: (() => true) as EnvDeleteCommandDeps["existsSync"],
		unlink: unlink as unknown as EnvDeleteCommandDeps["unlink"],
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
		chooseEnvironmentPrompt,
		unlink,
	}
}

describe("envDeleteCommand", () => {
	test("rejects invalid environment names", async () => {
		const { deps, logError, exit } = createDeps()

		await expect(envDeleteCommand("invalid!!", false, deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(String(logError.mock.calls[0]?.[0])).toContain(
			"invalid environment name",
		)
	})

	test("exits when environment file does not exist", async () => {
		const { deps, logError, exit } = createDeps({
			existsSync: (() => false) as EnvDeleteCommandDeps["existsSync"],
		})

		await expect(envDeleteCommand("staging", false, deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(String(logError.mock.calls[0]?.[0])).toContain("not found")
	})

	test("prompts for environment when arg is missing", async () => {
		const { deps, chooseEnvironmentPrompt, unlink } = createDeps()

		await envDeleteCommand("", true, deps)

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(unlink).toHaveBeenCalledWith(path.join(CWD, ".env.staging.enc"))
	})

	test("deletes file when confirmed", async () => {
		const { deps, confirmPrompt, unlink, log } = createDeps()

		await envDeleteCommand("staging", false, deps)

		expect(confirmPrompt).toHaveBeenCalledTimes(1)
		expect(unlink).toHaveBeenCalledWith(path.join(CWD, ".env.staging.enc"))
		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("deleted"))).toBe(true)
	})

	test("aborts when user declines", async () => {
		const { deps, unlink } = createDeps({
			confirmPrompt: mock(
				async () => false,
			) as unknown as EnvDeleteCommandDeps["confirmPrompt"],
		})

		await envDeleteCommand("staging", false, deps)

		expect(unlink).not.toHaveBeenCalled()
	})

	test("skips confirmation when yes=true", async () => {
		const { deps, confirmPrompt, unlink } = createDeps()

		await envDeleteCommand("staging", true, deps)

		expect(confirmPrompt).not.toHaveBeenCalled()
		expect(unlink).toHaveBeenCalledTimes(1)
	})
})

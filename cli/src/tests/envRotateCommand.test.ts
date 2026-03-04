import { describe, expect, mock, test } from "bun:test"
import path from "node:path"
import type { RotateCommandDeps } from "../commands/env/rotate"
import { rotateCommand } from "../commands/env/rotate"
import type { EnvFile } from "../helpers/findEnvironmentsRecursive"

const ROOT = "/workspace"

const makeEnvFile = (name: string, dir = ROOT): EnvFile => ({
	name,
	dir,
	filePath: path.join(dir, `.env.${name}.enc`),
})

const createDeps = (
	overrides: Partial<RotateCommandDeps> = {},
): {
	deps: RotateCommandDeps
	log: ReturnType<typeof mock>
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	chooseEnvironmentPrompt: ReturnType<typeof mock>
	confirmPrompt: ReturnType<typeof mock>
	findEnvironmentsRecursive: ReturnType<typeof mock>
	decryptEnvironmentData: ReturnType<typeof mock>
	encryptEnvironment: ReturnType<typeof mock>
} => {
	const chooseEnvironmentPrompt = mock(async () => "production")
	const confirmPrompt = mock(async () => true)
	const decryptEnvironmentData = mock(async () => "A=1")
	const encryptEnvironment = mock(
		async (_name: string, _content: string, _options?: object) => {},
	)
	const findEnvironmentsRecursive = mock(async () => [
		makeEnvFile("staging"),
		makeEnvFile("production"),
	])
	const log = mock((_message: string) => {})
	const logError = mock((_message: string) => {})
	const exit = mock((code: number): never => {
		throw new Error(`exit(${code})`)
	})

	const deps: RotateCommandDeps = {
		decryptEnvironmentData:
			decryptEnvironmentData as unknown as RotateCommandDeps["decryptEnvironmentData"],
		encryptEnvironment:
			encryptEnvironment as unknown as RotateCommandDeps["encryptEnvironment"],
		getEnvironmentByPath: mock(async () => ({
			version: 2 as const,
			keys: [],
			encryptedContent: "",
		})) as unknown as RotateCommandDeps["getEnvironmentByPath"],
		validateEnvironmentName: ((name: string) =>
			name === "invalid"
				? { valid: false, reason: "invalid environment" }
				: { valid: true }) as RotateCommandDeps["validateEnvironmentName"],
		chooseEnvironmentPrompt:
			chooseEnvironmentPrompt as unknown as RotateCommandDeps["chooseEnvironmentPrompt"],
		findEnvironmentsRecursive:
			findEnvironmentsRecursive as unknown as RotateCommandDeps["findEnvironmentsRecursive"],
		resolveProjectRoot: () => ROOT,
		confirmPrompt:
			confirmPrompt as unknown as RotateCommandDeps["confirmPrompt"],
		existsSync: (() => true) as RotateCommandDeps["existsSync"],
		cwd: () => ROOT,
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
		chooseEnvironmentPrompt,
		confirmPrompt,
		findEnvironmentsRecursive,
		decryptEnvironmentData,
		encryptEnvironment,
	}
}

describe("rotateCommand (single)", () => {
	test("prompts for missing environment and rotates data key", async () => {
		const {
			deps,
			chooseEnvironmentPrompt,
			decryptEnvironmentData,
			encryptEnvironment,
			log,
		} = createDeps()

		await rotateCommand("", false, false, deps)

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(decryptEnvironmentData).toHaveBeenCalledTimes(1)
		expect(encryptEnvironment).toHaveBeenCalledTimes(1)
		expect(String(log.mock.calls[0]?.[0])).toContain("Data key for production")
	})

	test("rotates the environment in cwd", async () => {
		const { deps, encryptEnvironment } = createDeps()

		await rotateCommand("production", false, false, deps)

		expect(encryptEnvironment).toHaveBeenCalledWith("production", "A=1", {
			baseDir: ROOT,
		})
	})

	test("exits on invalid environment name", async () => {
		const { deps, logError, exit, decryptEnvironmentData } = createDeps()

		await expect(rotateCommand("invalid", false, false, deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(decryptEnvironmentData).not.toHaveBeenCalled()
		expect(String(logError.mock.calls[0]?.[0])).toContain("invalid environment")
	})

	test("exits when environment file not found", async () => {
		const { deps, logError, exit } = createDeps({
			existsSync: (() => false) as RotateCommandDeps["existsSync"],
		})

		await expect(
			rotateCommand("production", false, false, deps),
		).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
		expect(String(logError.mock.calls[0]?.[0])).toContain("not found")
	})

	test("exits when decryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			decryptEnvironmentData: mock(async () => {
				throw new Error("decrypt failed")
			}) as unknown as RotateCommandDeps["decryptEnvironmentData"],
		})

		await expect(
			rotateCommand("production", false, false, deps),
		).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("decrypt failed")
	})

	test("exits when encryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			encryptEnvironment: mock(async () => {
				throw new Error("encrypt failed")
			}) as unknown as RotateCommandDeps["encryptEnvironment"],
		})

		await expect(
			rotateCommand("production", false, false, deps),
		).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("encrypt failed")
	})
})

describe("rotateCommand --all", () => {
	test("prints 'No environments found' when list is empty", async () => {
		const { deps, log, decryptEnvironmentData } = createDeps({
			findEnvironmentsRecursive: mock(
				async () => [],
			) as unknown as RotateCommandDeps["findEnvironmentsRecursive"],
		})

		await rotateCommand("", true, true, deps)

		expect(decryptEnvironmentData).not.toHaveBeenCalled()
		const logged = log.mock.calls.map((c) => String(c[0]))
		expect(logged.some((m) => m.includes("No environments found"))).toBe(true)
	})

	test("rotates all environments when yes=true", async () => {
		const { deps, decryptEnvironmentData, encryptEnvironment } = createDeps()

		await rotateCommand("", true, true, deps)

		expect(decryptEnvironmentData).toHaveBeenCalledTimes(2)
		expect(encryptEnvironment).toHaveBeenCalledTimes(2)
	})

	test("aborts when user declines", async () => {
		const { deps, encryptEnvironment } = createDeps({
			confirmPrompt: mock(
				async () => false,
			) as unknown as RotateCommandDeps["confirmPrompt"],
		})

		await rotateCommand("", true, false, deps)

		expect(encryptEnvironment).not.toHaveBeenCalled()
	})

	test("skips confirmation when yes=true", async () => {
		const { deps, confirmPrompt } = createDeps()

		await rotateCommand("", true, true, deps)

		expect(confirmPrompt).not.toHaveBeenCalled()
	})

	test("reports per-file errors but continues (best-effort)", async () => {
		const { deps, logError } = createDeps({
			decryptEnvironmentData: mock(async () => {
				throw new Error("decrypt failed")
			}) as unknown as RotateCommandDeps["decryptEnvironmentData"],
		})

		await rotateCommand("", true, true, deps)

		const errors = logError.mock.calls.map((c) => String(c[0]))
		expect(errors.length).toBeGreaterThan(0)
	})

	test("prints per-file success/failure summary", async () => {
		const { deps, log, logError } = createDeps({
			encryptEnvironment: mock(async (_name: string) => {
				if (_name === "production") throw new Error("encrypt failed")
			}) as unknown as RotateCommandDeps["encryptEnvironment"],
		})

		await rotateCommand("", true, true, deps)

		const logged = log.mock.calls.map((c) => String(c[0]))
		const errors = logError.mock.calls.map((c) => String(c[0]))

		expect(logged.some((m) => m.includes("staging"))).toBe(true)
		expect(errors.some((m) => m.includes("production"))).toBe(true)
	})

	test("recursively discovers and rotates nested env files", async () => {
		const subdir = path.join(ROOT, "packages", "web")
		const { deps, decryptEnvironmentData, encryptEnvironment } = createDeps({
			findEnvironmentsRecursive: mock(async () => [
				makeEnvFile("staging", ROOT),
				makeEnvFile("staging", subdir),
			]) as unknown as RotateCommandDeps["findEnvironmentsRecursive"],
		})

		await rotateCommand("", true, true, deps)

		expect(decryptEnvironmentData).toHaveBeenCalledTimes(2)
		expect(encryptEnvironment).toHaveBeenCalledTimes(2)
	})
})

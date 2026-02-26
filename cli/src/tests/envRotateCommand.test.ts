import { describe, expect, mock, test } from "bun:test"
import type { RotateCommandDeps } from "../commands/env/rotate"
import { rotateCommand } from "../commands/env/rotate"

const createDeps = (
	overrides: Partial<RotateCommandDeps> = {},
): {
	deps: RotateCommandDeps
	log: ReturnType<typeof mock>
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	chooseEnvironmentPrompt: ReturnType<typeof mock>
	decryptEnvironment: ReturnType<typeof mock>
	encryptEnvironment: ReturnType<typeof mock>
} => {
	const chooseEnvironmentPrompt = mock(async () => "production")
	const decryptEnvironment = mock(async () => "A=1")
	const encryptEnvironment = mock(
		async (_name: string, _content: string, _options?: object) => {},
	)
	const log = mock((_message: string) => {})
	const logError = mock((_message: string) => {})
	const exit = mock((code: number): never => {
		throw new Error(`exit(${code})`)
	})

	const deps = {
		decryptEnvironment:
			decryptEnvironment as unknown as RotateCommandDeps["decryptEnvironment"],
		encryptEnvironment:
			encryptEnvironment as unknown as RotateCommandDeps["encryptEnvironment"],
		validateEnvironmentName: ((name: string) =>
			name === "invalid"
				? { valid: false, reason: "invalid environment" }
				: { valid: true }) as RotateCommandDeps["validateEnvironmentName"],
		chooseEnvironmentPrompt:
			chooseEnvironmentPrompt as unknown as RotateCommandDeps["chooseEnvironmentPrompt"],
		log,
		logError,
		exit,
		...overrides,
	} as RotateCommandDeps

	return {
		deps,
		log,
		logError,
		exit,
		chooseEnvironmentPrompt,
		decryptEnvironment,
		encryptEnvironment,
	}
}

describe("rotateCommand", () => {
	test("prompts for missing environment and rotates data key", async () => {
		const {
			deps,
			chooseEnvironmentPrompt,
			decryptEnvironment,
			encryptEnvironment,
			log,
		} = createDeps()

		await rotateCommand("", deps)

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(decryptEnvironment).toHaveBeenCalledWith("production")
		expect(encryptEnvironment).toHaveBeenCalledWith("production", "A=1")
		expect(String(log.mock.calls[0]?.[0])).toContain("Data key for production")
	})

	test("exits on invalid environment name", async () => {
		const { deps, logError, exit, decryptEnvironment } = createDeps()

		await expect(rotateCommand("invalid", deps)).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
		expect(decryptEnvironment).not.toHaveBeenCalled()
		expect(String(logError.mock.calls[0]?.[0])).toContain("invalid environment")
	})

	test("exits when decryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			decryptEnvironment: mock(async () => {
				throw new Error("decrypt failed")
			}) as unknown as RotateCommandDeps["decryptEnvironment"],
		})

		await expect(rotateCommand("production", deps)).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("decrypt failed")
	})

	test("exits when encryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			encryptEnvironment: mock(async () => {
				throw new Error("encrypt failed")
			}) as unknown as RotateCommandDeps["encryptEnvironment"],
		})

		await expect(rotateCommand("production", deps)).rejects.toThrow("exit(1)")

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("encrypt failed")
	})
})

import { describe, expect, mock, test } from "bun:test"
import type { GrantCommandDeps } from "../commands/auth/grant"
import { grantCommand } from "../commands/auth/grant"

const createDeps = (
	overrides: Partial<GrantCommandDeps> = {},
): {
	deps: GrantCommandDeps
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	chooseEnvironmentPrompt: ReturnType<typeof mock>
	choosePublicKeyPrompt: ReturnType<typeof mock>
	decryptEnvironment: ReturnType<typeof mock>
	getPublicKeyByName: ReturnType<typeof mock>
	encryptEnvironment: ReturnType<typeof mock>
} => {
	const chooseEnvironmentPrompt = mock(async () => "production")
	const choosePublicKeyPrompt = mock(async () => "alice")
	const decryptEnvironment = mock(async () => "API_KEY=secret")
	const getPublicKeyByName = mock(async (_name: string) => ({}))
	const encryptEnvironment = mock(
		async (_name: string, _content: string, _options?: object) => {},
	)
	const logError = mock((_message: string) => {})
	const exit = mock((code: number): never => {
		throw new Error(`exit(${code})`)
	})

	const deps = {
		decryptEnvironment:
			decryptEnvironment as unknown as GrantCommandDeps["decryptEnvironment"],
		encryptEnvironment:
			encryptEnvironment as unknown as GrantCommandDeps["encryptEnvironment"],
		getPublicKeyByName:
			getPublicKeyByName as unknown as GrantCommandDeps["getPublicKeyByName"],
		validateEnvironmentName: ((name: string) =>
			name === "invalid"
				? { valid: false, reason: "invalid environment" }
				: { valid: true }) as GrantCommandDeps["validateEnvironmentName"],
		chooseEnvironmentPrompt:
			chooseEnvironmentPrompt as unknown as GrantCommandDeps["chooseEnvironmentPrompt"],
		choosePublicKeyPrompt:
			choosePublicKeyPrompt as unknown as GrantCommandDeps["choosePublicKeyPrompt"],
		logError,
		exit,
		...overrides,
	} as GrantCommandDeps

	return {
		deps,
		logError,
		exit,
		chooseEnvironmentPrompt,
		choosePublicKeyPrompt,
		decryptEnvironment,
		getPublicKeyByName,
		encryptEnvironment,
	}
}

describe("grantCommand", () => {
	test("prompts for missing args and grants access", async () => {
		const {
			deps,
			chooseEnvironmentPrompt,
			choosePublicKeyPrompt,
			decryptEnvironment,
			getPublicKeyByName,
			encryptEnvironment,
		} = createDeps()

		await grantCommand("", "", deps)

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(choosePublicKeyPrompt).toHaveBeenCalledTimes(1)
		expect(decryptEnvironment).toHaveBeenCalledWith("production")
		expect(getPublicKeyByName).toHaveBeenCalledWith("alice")
		expect(encryptEnvironment).toHaveBeenCalledWith(
			"production",
			"API_KEY=secret",
			{
				grantPublicKeys: ["alice"],
			},
		)
	})

	test("exits on invalid environment name", async () => {
		const { deps, logError, exit, decryptEnvironment } = createDeps()

		await expect(grantCommand("invalid", "alice", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(decryptEnvironment).not.toHaveBeenCalled()
		expect(String(logError.mock.calls[0]?.[0])).toContain("invalid environment")
	})

	test("exits when decryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			decryptEnvironment: mock(async () => {
				throw new Error("decrypt failed")
			}) as unknown as GrantCommandDeps["decryptEnvironment"],
		})

		await expect(grantCommand("production", "alice", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("decrypt failed")
	})

	test("exits when public key lookup fails", async () => {
		const { deps, logError, exit } = createDeps({
			getPublicKeyByName: mock(async () => {
				throw new Error("key not found")
			}) as unknown as GrantCommandDeps["getPublicKeyByName"],
		})

		await expect(grantCommand("production", "alice", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("key not found")
	})

	test("exits when encryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			encryptEnvironment: mock(async () => {
				throw new Error("encrypt failed")
			}) as unknown as GrantCommandDeps["encryptEnvironment"],
		})

		await expect(grantCommand("production", "alice", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("encrypt failed")
	})
})

import { describe, expect, mock, test } from "bun:test"
import type { RevokeCommandDeps } from "../commands/auth/revoke"
import { revokeCommand } from "../commands/auth/revoke"

const createDeps = (
	overrides: Partial<RevokeCommandDeps> = {},
): {
	deps: RevokeCommandDeps
	logError: ReturnType<typeof mock>
	exit: ReturnType<typeof mock>
	chooseEnvironmentPrompt: ReturnType<typeof mock>
	choosePublicKeyPrompt: ReturnType<typeof mock>
	decryptEnvironment: ReturnType<typeof mock>
	getPublicKeyByName: ReturnType<typeof mock>
	encryptEnvironment: ReturnType<typeof mock>
} => {
	const chooseEnvironmentPrompt = mock(async () => "staging")
	const choosePublicKeyPrompt = mock(async () => "bob")
	const decryptEnvironment = mock(async () => "TOKEN=secret")
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
			decryptEnvironment as unknown as RevokeCommandDeps["decryptEnvironment"],
		encryptEnvironment:
			encryptEnvironment as unknown as RevokeCommandDeps["encryptEnvironment"],
		getPublicKeyByName:
			getPublicKeyByName as unknown as RevokeCommandDeps["getPublicKeyByName"],
		validateEnvironmentName: ((name: string) =>
			name === "invalid"
				? { valid: false, reason: "invalid environment" }
				: { valid: true }) as RevokeCommandDeps["validateEnvironmentName"],
		chooseEnvironmentPrompt:
			chooseEnvironmentPrompt as unknown as RevokeCommandDeps["chooseEnvironmentPrompt"],
		choosePublicKeyPrompt:
			choosePublicKeyPrompt as unknown as RevokeCommandDeps["choosePublicKeyPrompt"],
		logError,
		exit,
		...overrides,
	} as RevokeCommandDeps

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

describe("revokeCommand", () => {
	test("prompts for missing args and revokes access", async () => {
		const {
			deps,
			chooseEnvironmentPrompt,
			choosePublicKeyPrompt,
			decryptEnvironment,
			getPublicKeyByName,
			encryptEnvironment,
		} = createDeps()

		await revokeCommand("", "", deps)

		expect(chooseEnvironmentPrompt).toHaveBeenCalledTimes(1)
		expect(choosePublicKeyPrompt).toHaveBeenCalledTimes(1)
		expect(decryptEnvironment).toHaveBeenCalledWith("staging")
		expect(getPublicKeyByName).toHaveBeenCalledWith("bob")
		expect(encryptEnvironment).toHaveBeenCalledWith("staging", "TOKEN=secret", {
			revokePublicKeys: ["bob"],
		})
	})

	test("exits on invalid environment name", async () => {
		const { deps, logError, exit, decryptEnvironment } = createDeps()

		await expect(revokeCommand("invalid", "bob", deps)).rejects.toThrow(
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
			}) as unknown as RevokeCommandDeps["decryptEnvironment"],
		})

		await expect(revokeCommand("staging", "bob", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("decrypt failed")
	})

	test("exits when public key lookup fails", async () => {
		const { deps, logError, exit } = createDeps({
			getPublicKeyByName: mock(async () => {
				throw new Error("key not found")
			}) as unknown as RevokeCommandDeps["getPublicKeyByName"],
		})

		await expect(revokeCommand("staging", "bob", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("key not found")
	})

	test("exits when encryption fails", async () => {
		const { deps, logError, exit } = createDeps({
			encryptEnvironment: mock(async () => {
				throw new Error("encrypt failed")
			}) as unknown as RevokeCommandDeps["encryptEnvironment"],
		})

		await expect(revokeCommand("staging", "bob", deps)).rejects.toThrow(
			"exit(1)",
		)

		expect(exit).toHaveBeenCalledWith(1)
		expect(logError).toHaveBeenCalledWith("encrypt failed")
	})
})

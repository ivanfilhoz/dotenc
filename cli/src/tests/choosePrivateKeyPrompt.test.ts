import { describe, expect, mock, test } from "bun:test"
import crypto from "node:crypto"
import type { PrivateKeyEntry } from "../helpers/getPrivateKeys"
import {
	_runChoosePrivateKeyPrompt,
	CREATE_NEW_PRIVATE_KEY_CHOICE,
} from "../prompts/choosePrivateKey"

const createPrivateKeyEntry = (
	name: string,
	algorithm: "rsa" | "ed25519",
): PrivateKeyEntry => {
	if (algorithm === "rsa") {
		const { privateKey } = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
		})
		return {
			name,
			privateKey,
			fingerprint: `${name}-fingerprint`,
			algorithm,
		}
	}

	const { privateKey } = crypto.generateKeyPairSync("ed25519")
	return {
		name,
		privateKey,
		fingerprint: `${name}-fingerprint`,
		algorithm,
		rawSeed: Buffer.alloc(32),
		rawPublicKey: Buffer.alloc(32),
	}
}

const createWeakRsaPrivateKeyEntry = (name: string): PrivateKeyEntry => {
	const { privateKey } = crypto.generateKeyPairSync("rsa", {
		modulusLength: 1024,
	})
	return {
		name,
		privateKey,
		fingerprint: `${name}-fingerprint`,
		algorithm: "rsa",
	}
}

describe("choosePrivateKeyPrompt", () => {
	test("shows unsupported keys and create option while selecting supported key", async () => {
		const selectedKey = createPrivateKeyEntry("id_ed25519", "ed25519")

		const getPrivateKeys = mock(
			async () =>
				({
					keys: [selectedKey],
					passphraseProtectedKeys: ["id_locked"],
					unsupportedKeys: [
						{ name: "id_locked", reason: "passphrase-protected" },
						{ name: "id_ecdsa", reason: "unsupported algorithm: ec" },
					],
				}) as never,
		)
		const prompt = mock(async (_questions: unknown) => ({
			key: "id_ed25519",
		}))

		const selected = await _runChoosePrivateKeyPrompt("Pick key", {
			getPrivateKeys: getPrivateKeys as never,
			prompt: prompt as never,
			createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
			logInfo: mock((_message: string) => {}),
			logWarn: mock((_message: string) => {}),
			isInteractive: () => true,
		})

		expect(selected).toBe(selectedKey)
		expect(prompt).toHaveBeenCalledTimes(1)
		const [question] = prompt.mock.calls[0][0] as Array<{
			type: string
			choices: Array<{ name: string; value: string }>
		}>
		expect(question.type).toBe("list")
		expect(
			question.choices.some((choice) => choice.name.includes("id_locked")),
		).toBe(true)
		expect(
			question.choices.some((choice) => choice.name.includes("id_ecdsa")),
		).toBe(true)
		expect(question.choices[question.choices.length - 1].value).toBe(
			CREATE_NEW_PRIVATE_KEY_CHOICE,
		)
	})

	test("creates a new key and re-prompts until a supported key is selected", async () => {
		const createdKey = createPrivateKeyEntry("id_ed25519_dotenc", "ed25519")
		let getPrivateKeysCall = 0
		const getPrivateKeys = mock(
			async () =>
				({
					keys: getPrivateKeysCall++ === 0 ? [] : [createdKey],
					passphraseProtectedKeys: ["id_old"],
					unsupportedKeys: [{ name: "id_old", reason: "passphrase-protected" }],
				}) as never,
		)

		let promptCall = 0
		const prompt = mock(async (_questions: unknown) => {
			promptCall += 1
			if (promptCall === 1) {
				return { key: CREATE_NEW_PRIVATE_KEY_CHOICE }
			}
			return { key: "id_ed25519_dotenc" }
		})
		const createEd25519SshKey = mock(async () => "/tmp/id_ed25519_dotenc")
		const logInfo = mock((_message: string) => {})
		const logWarn = mock((_message: string) => {})

		const selected = await _runChoosePrivateKeyPrompt("Pick key", {
			getPrivateKeys: getPrivateKeys as never,
			prompt: prompt as never,
			createEd25519SshKey: createEd25519SshKey as never,
			logInfo,
			logWarn,
			isInteractive: () => true,
		})

		expect(selected).toBe(createdKey)
		expect(createEd25519SshKey).toHaveBeenCalledTimes(1)
		expect(prompt).toHaveBeenCalledTimes(2)
		expect(getPrivateKeys).toHaveBeenCalledTimes(2)
		expect(logInfo).toHaveBeenCalled()
		expect(logWarn).not.toHaveBeenCalled()
	})

	test("uses the first available key in non-interactive mode", async () => {
		const selectedKey = createPrivateKeyEntry("id_ed25519", "ed25519")
		const getPrivateKeys = mock(
			async () =>
				({
					keys: [selectedKey],
					passphraseProtectedKeys: [],
					unsupportedKeys: [
						{ name: "id_ecdsa", reason: "unsupported algorithm: ec" },
					],
				}) as never,
		)
		const prompt = mock(async (_questions: unknown) => ({
			key: "id_ed25519",
		}))

		const selected = await _runChoosePrivateKeyPrompt("Pick key", {
			getPrivateKeys: getPrivateKeys as never,
			prompt: prompt as never,
			createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
			logInfo: mock((_message: string) => {}),
			logWarn: mock((_message: string) => {}),
			isInteractive: () => false,
		})

		expect(selected).toBe(selectedKey)
		expect(prompt).not.toHaveBeenCalled()
	})

	test("ignores weak RSA keys and picks a valid key in non-interactive mode", async () => {
		const weakRsa = createWeakRsaPrivateKeyEntry("id_rsa")
		const strongEd25519 = createPrivateKeyEntry("id_ed25519_alt", "ed25519")
		const getPrivateKeys = mock(
			async () =>
				({
					keys: [weakRsa, strongEd25519],
					passphraseProtectedKeys: [],
					unsupportedKeys: [],
				}) as never,
		)

		const selected = await _runChoosePrivateKeyPrompt("Pick key", {
			getPrivateKeys: getPrivateKeys as never,
			prompt: mock(async (_questions: unknown) => ({ key: "" })) as never,
			createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
			logInfo: mock((_message: string) => {}),
			logWarn: mock((_message: string) => {}),
			isInteractive: () => false,
		})

		expect(selected).toBe(strongEd25519)
	})

	test("shows weak RSA keys as unsupported in interactive mode", async () => {
		const weakRsa = createWeakRsaPrivateKeyEntry("id_rsa")
		const strongEd25519 = createPrivateKeyEntry("id_ed25519_alt", "ed25519")
		const getPrivateKeys = mock(
			async () =>
				({
					keys: [weakRsa, strongEd25519],
					passphraseProtectedKeys: [],
					unsupportedKeys: [],
				}) as never,
		)
		const prompt = mock(async (_questions: unknown) => ({
			key: "id_ed25519_alt",
		}))

		await _runChoosePrivateKeyPrompt("Pick key", {
			getPrivateKeys: getPrivateKeys as never,
			prompt: prompt as never,
			createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
			logInfo: mock((_message: string) => {}),
			logWarn: mock((_message: string) => {}),
			isInteractive: () => true,
		})

		const [question] = prompt.mock.calls[0][0] as Array<{
			choices: Array<{ name: string }>
		}>
		expect(
			question.choices.some((choice) =>
				choice.name.includes("RSA key is 1024 bits"),
			),
		).toBe(true)
	})

	test("throws passphrase guidance in non-interactive mode when no usable keys exist", async () => {
		const getPrivateKeys = mock(
			async () =>
				({
					keys: [],
					passphraseProtectedKeys: ["id_locked"],
					unsupportedKeys: [
						{ name: "id_locked", reason: "passphrase-protected" },
					],
				}) as never,
		)

		await expect(
			_runChoosePrivateKeyPrompt("Pick key", {
				getPrivateKeys: getPrivateKeys as never,
				prompt: mock(async (_questions: unknown) => ({ key: "" })) as never,
				createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
				logInfo: mock((_message: string) => {}),
				logWarn: mock((_message: string) => {}),
				isInteractive: () => false,
			}),
		).rejects.toThrow("passphrase-protected")
	})

	test("throws unsupported summary in non-interactive mode when all keys are unsupported", async () => {
		const getPrivateKeys = mock(
			async () =>
				({
					keys: [],
					passphraseProtectedKeys: [],
					unsupportedKeys: [
						{ name: "id_ecdsa", reason: "unsupported algorithm" },
					],
				}) as never,
		)

		await expect(
			_runChoosePrivateKeyPrompt("Pick key", {
				getPrivateKeys: getPrivateKeys as never,
				prompt: mock(async (_questions: unknown) => ({ key: "" })) as never,
				createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
				logInfo: mock((_message: string) => {}),
				logWarn: mock((_message: string) => {}),
				isInteractive: () => false,
			}),
		).rejects.toThrow("No supported SSH keys found")
	})

	test("throws no-keys guidance in non-interactive mode when no keys exist", async () => {
		const getPrivateKeys = mock(
			async () =>
				({
					keys: [],
					passphraseProtectedKeys: [],
					unsupportedKeys: [],
				}) as never,
		)

		await expect(
			_runChoosePrivateKeyPrompt("Pick key", {
				getPrivateKeys: getPrivateKeys as never,
				prompt: mock(async (_questions: unknown) => ({ key: "" })) as never,
				createEd25519SshKey: mock(async () => "/tmp/new-key") as never,
				logInfo: mock((_message: string) => {}),
				logWarn: mock((_message: string) => {}),
				isInteractive: () => false,
			}),
		).rejects.toThrow("No SSH keys found in ~/.ssh/")
	})
})

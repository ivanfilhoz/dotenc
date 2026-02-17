import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test"
import crypto from "node:crypto"
import type { PrivateKeyEntry } from "../helpers/getPrivateKeys"
import type { PublicKeyEntry } from "../helpers/getPublicKeys"

const ed25519KeyPair = crypto.generateKeyPairSync("ed25519")

function fingerprint(key: crypto.KeyObject): string {
	const pub = key.type === "public" ? key : crypto.createPublicKey(key)
	const der = pub.export({ type: "spki", format: "der" }) as Buffer
	return crypto.createHash("sha256").update(der).digest("hex")
}

const fp = fingerprint(ed25519KeyPair.publicKey)

describe("devCommand", () => {
	let runCommandMock: ReturnType<typeof mock>
	let consoleErrorSpy: ReturnType<typeof spyOn>
	let processExitSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		runCommandMock = mock(() => Promise.resolve())
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {})
		processExitSpy = spyOn(process, "exit").mockImplementation(
			() => undefined as never,
		)
	})

	afterEach(() => {
		mock.restore()
		consoleErrorSpy.mockRestore()
		processExitSpy.mockRestore()
	})

	test("delegates to runCommand with development,<keyName>", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({
					keys: [
						{
							name: "id_ed25519",
							privateKey: ed25519KeyPair.privateKey,
							fingerprint: fp,
							algorithm: "ed25519",
						} satisfies PrivateKeyEntry,
					],
					passphraseProtectedKeys: [],
				}),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () =>
				Promise.resolve([
					{
						name: "alice",
						publicKey: ed25519KeyPair.publicKey,
						fingerprint: fp,
						algorithm: "ed25519",
					} satisfies PublicKeyEntry,
				]),
		}))
		mock.module("../commands/run", () => ({
			runCommand: runCommandMock,
		}))

		const { devCommand } = await import("../commands/dev")
		await devCommand("node", ["app.js"])

		expect(runCommandMock).toHaveBeenCalledTimes(1)
		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice",
		})
	})

	test("prints error when no identity is found", async () => {
		mock.module("../helpers/getPrivateKeys", () => ({
			getPrivateKeys: () =>
				Promise.resolve({ keys: [], passphraseProtectedKeys: [] }),
		}))
		mock.module("../helpers/getPublicKeys", () => ({
			getPublicKeys: () => Promise.resolve([]),
		}))
		mock.module("../commands/run", () => ({
			runCommand: runCommandMock,
		}))

		processExitSpy.mockImplementation(() => {
			throw new Error("process.exit called")
		})

		const { devCommand } = await import("../commands/dev")
		try {
			await devCommand("node", ["app.js"])
		} catch {
			// Expected: process.exit mock throws
		}

		expect(runCommandMock).not.toHaveBeenCalled()
		expect(processExitSpy).toHaveBeenCalledWith(1)
		expect(consoleErrorSpy).toHaveBeenCalled()
		const errorMessage = consoleErrorSpy.mock.calls[0][0] as string
		expect(errorMessage).toContain("could not resolve your identity")
	})
})

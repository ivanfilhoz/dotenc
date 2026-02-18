import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import crypto from "node:crypto"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { keyAddCommand } from "../commands/key/add"

describe("keyAddCommand", () => {
	let tmpDir: string
	let cwdSpy: ReturnType<typeof spyOn>
	let exitSpy: ReturnType<typeof spyOn>
	let errorSpy: ReturnType<typeof spyOn>
	let logSpy: ReturnType<typeof spyOn>
	let publicKeyPem: string

	beforeEach(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "dotenc-key-add-"))
		mkdirSync(path.join(tmpDir, ".dotenc"), { recursive: true })
		cwdSpy = spyOn(process, "cwd").mockReturnValue(tmpDir)
		exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
			throw new Error(`process.exit(${code})`)
		})
		errorSpy = spyOn(console, "error").mockImplementation(() => {})
		logSpy = spyOn(console, "log").mockImplementation(() => {})

		const { publicKey } = crypto.generateKeyPairSync("ed25519")
		publicKeyPem = publicKey
			.export({ type: "spki", format: "pem" })
			.toString("utf-8")
	})

	afterEach(() => {
		cwdSpy.mockRestore()
		exitSpy.mockRestore()
		errorSpy.mockRestore()
		logSpy.mockRestore()
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("rejects invalid key names from CLI args", async () => {
		await expect(
			keyAddCommand("../escape", { fromString: publicKeyPem }),
		).rejects.toThrow("process.exit(1)")
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	test("rejects duplicate key names from CLI args", async () => {
		await keyAddCommand("alice", { fromString: publicKeyPem })

		await expect(
			keyAddCommand("alice", { fromString: publicKeyPem }),
		).rejects.toThrow("process.exit(1)")

		expect(exitSpy).toHaveBeenCalledWith(1)
	})
})

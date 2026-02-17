import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getEnvironmentByName } from "../helpers/getEnvironmentByName"

describe("getEnvironmentByName", () => {
	const originalCwd = process.cwd()
	let tempDir: string | undefined

	afterEach(() => {
		process.chdir(originalCwd)
		if (tempDir) rmSync(tempDir, { recursive: true, force: true })
		tempDir = undefined
	})

	test("loads environment file from current working directory", async () => {
		tempDir = mkdtempSync(path.join(os.tmpdir(), "dotenc-env-name-"))
		process.chdir(tempDir)

		const expected = {
			keys: [
				{
					name: "alice",
					fingerprint: "fp-alice",
					encryptedDataKey: Buffer.from("data-key").toString("base64"),
					algorithm: "ed25519" as const,
				},
			],
			encryptedContent: Buffer.from("secret=value").toString("base64"),
		}

		writeFileSync(
			path.join(tempDir, ".env.staging.enc"),
			JSON.stringify(expected, null, 2),
		)

		await expect(getEnvironmentByName("staging")).resolves.toEqual(expected)
	})

	test("throws when the named environment file does not exist", async () => {
		tempDir = mkdtempSync(path.join(os.tmpdir(), "dotenc-env-name-missing-"))
		process.chdir(tempDir)

		await expect(getEnvironmentByName("missing")).rejects.toThrow(
			/Environment file not found/,
		)
	})
})

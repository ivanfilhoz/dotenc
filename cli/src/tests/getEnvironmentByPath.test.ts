import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getEnvironmentByPath } from "../helpers/getEnvironmentByPath"

describe("getEnvironmentByPath", () => {
	let tmpDir: string

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-envpath-"))
	})

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("parses a valid environment file", async () => {
		const env = {
			keys: [
				{
					name: "alice",
					fingerprint: "abc123",
					encryptedDataKey: "ZW5jcnlwdGVk",
					algorithm: "ed25519",
				},
			],
			encryptedContent: "ZW5jcnlwdGVk",
		}
		const filePath = path.join(tmpDir, ".env.test.enc")
		writeFileSync(filePath, JSON.stringify(env), "utf-8")

		const result = await getEnvironmentByPath(filePath)
		expect(result.keys).toHaveLength(1)
		expect(result.keys[0].name).toBe("alice")
		expect(result.encryptedContent).toBe("ZW5jcnlwdGVk")
	})

	test("throws when file does not exist", async () => {
		const filePath = path.join(tmpDir, "nonexistent.enc")
		await expect(getEnvironmentByPath(filePath)).rejects.toThrow(
			/Environment file not found/,
		)
	})

	test("throws when file contains invalid JSON", async () => {
		const filePath = path.join(tmpDir, "bad.enc")
		writeFileSync(filePath, "not json", "utf-8")

		await expect(getEnvironmentByPath(filePath)).rejects.toThrow(
			/Failed to parse the environment file/,
		)
	})

	test("throws when JSON does not match schema", async () => {
		const filePath = path.join(tmpDir, "bad-schema.enc")
		writeFileSync(filePath, JSON.stringify({ foo: "bar" }), "utf-8")

		await expect(getEnvironmentByPath(filePath)).rejects.toThrow(
			/Failed to parse the environment file/,
		)
	})
})

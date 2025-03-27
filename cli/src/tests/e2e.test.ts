import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import { editCommand } from "../commands/edit"
import { initCommand } from "../commands/init"
import { runCommand } from "../commands/run"
import { waitForFile } from "./helpers/waitForFile"

const localEnvFilePath = path.join(process.cwd(), ".env")
const encryptedEnvFilePath = path.join(process.cwd(), ".env.test.enc")
const projectFilePath = path.join(process.cwd(), "dotenc.json")
const outputFilePath = path.join(process.cwd(), "e2e.txt")

vi.mock("node:child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:child_process")>()
	return {
		...actual,
		// Mock for the edit command
		execSync: () => {
			const tempFilePath = path.join(os.tmpdir(), ".env.test")
			writeFileSync(tempFilePath, "DOTENC_HELLO=Hello, world!")
		},
	}
})

describe("e2e", () => {
	beforeAll(() => {
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(process, "exit").mockImplementation(() => ({}) as never)
	})

	test("should initialize an environment", async () => {
		await initCommand("test")
		expect(existsSync(localEnvFilePath)).toBe(true)
		expect(existsSync(encryptedEnvFilePath)).toBe(true)
		expect(existsSync(projectFilePath)).toBe(true)
	})

	test("should edit an environment", async () => {
		const initialContent = readFileSync(encryptedEnvFilePath, "utf-8")
		await editCommand("test")
		const editedContent = readFileSync(encryptedEnvFilePath, "utf-8")
		expect(editedContent).not.toBe(initialContent)
	})

	test("should run a command in an environment", async () => {
		await runCommand("sh", [path.join(__dirname, "helpers", "e2e.sh")], {
			env: "test",
		})
		const output = await waitForFile(outputFilePath)
		expect(output).toBe("Hello, world!\n")
	})

	afterAll(() => {
		unlinkSync(localEnvFilePath)
		unlinkSync(encryptedEnvFilePath)
		unlinkSync(projectFilePath)
		unlinkSync(outputFilePath)
	})
})

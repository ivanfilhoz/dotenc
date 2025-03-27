import { existsSync, readFileSync, unlinkSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import { initCommand } from "../commands/init"
import { runCommand } from "../commands/run"

const waitForFile = (filePath: string, timeout = 5000) =>
	new Promise((resolve, reject) => {
		const startTime = Date.now()
		const interval = setInterval(() => {
			if (existsSync(filePath)) {
				clearInterval(interval)
				resolve(readFileSync(filePath, "utf-8"))
				return
			}

			if (Date.now() - startTime > timeout) {
				clearInterval(interval)
				reject(new Error(`Timeout waiting for file ${filePath}`))
			}
		}, 100)
	})

const localEnvFilePath = path.join(process.cwd(), ".env")
const encryptedEnvFilePath = path.join(process.cwd(), ".env.test.enc")
const projectFilePath = path.join(process.cwd(), "dotenc.json")
const outputFilePath = path.join(process.cwd(), "e2e.txt")

describe("e2e", () => {
	beforeAll(() => {
		vi.spyOn(console, "log").mockImplementation(() => {})
	})

	test("should initialize an environment", async () => {
		await initCommand("test")
		expect(existsSync(localEnvFilePath)).toBe(true)
		expect(existsSync(encryptedEnvFilePath)).toBe(true)
		expect(existsSync(projectFilePath)).toBe(true)
	})

	test("should run a command in an environment", async () => {
		await runCommand("sh", [path.join(__dirname, "e2e.sh")], {
			env: "test",
			test: true,
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

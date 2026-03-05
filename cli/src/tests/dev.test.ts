import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test"

const getCurrentKeyName = mock(async () => ["alice"])
const runCommandMock = mock(async () => {})
const inquirerPromptMock = mock(async () => ({ selected: "" }))

mock.module("../helpers/getCurrentKeyName", () => ({ getCurrentKeyName }))
mock.module("../commands/run", () => ({ runCommand: runCommandMock }))
mock.module("inquirer", () => ({ default: { prompt: inquirerPromptMock } }))

const { devCommand } = await import("../commands/dev")

beforeEach(() => {
	getCurrentKeyName.mockClear()
	runCommandMock.mockClear()
	inquirerPromptMock.mockClear()
	getCurrentKeyName.mockImplementation(async () => ["alice"])
	runCommandMock.mockImplementation(async () => {})
	inquirerPromptMock.mockImplementation(async () => ({ selected: "" }))
})

describe("devCommand", () => {
	test("delegates to runCommand with development,<keyName>", async () => {
		await devCommand("node", ["app.js"], {})

		expect(runCommandMock).toHaveBeenCalledTimes(1)
		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice",
			localOnly: undefined,
		})
		expect(inquirerPromptMock).not.toHaveBeenCalled()
	})

	test("prints error when no identity is found", async () => {
		getCurrentKeyName.mockImplementation(async () => [])

		const errSpy = spyOn(console, "error").mockImplementation(() => {})
		const exitSpy = spyOn(process, "exit").mockImplementation((code): never => {
			throw new Error(`process.exit(${code})`)
		})

		await expect(devCommand("node", ["app.js"], {})).rejects.toThrow(
			"process.exit(1)",
		)

		expect(runCommandMock).not.toHaveBeenCalled()
		expect(exitSpy).toHaveBeenCalledWith(1)
		expect(errSpy).toHaveBeenCalledTimes(1)
		const [errorMessage] = errSpy.mock.calls[0] as [string]
		expect(errorMessage).toContain("could not resolve your identity")
		errSpy.mockRestore()
		exitSpy.mockRestore()
	})

	test("prompts user to select identity when multiple keys match", async () => {
		getCurrentKeyName.mockImplementation(async () => ["alice", "alice-deploy"])
		inquirerPromptMock.mockImplementation(async () => ({
			selected: "alice-deploy",
		}))

		await devCommand("node", ["app.js"], {})

		expect(inquirerPromptMock).toHaveBeenCalledTimes(1)
		const [promptArgs] = inquirerPromptMock.mock.calls[0] as unknown as [
			Array<{ message: string; choices: { name: string; value: string }[] }>,
		]
		expect(promptArgs[0].message).toContain("Multiple identities")
		expect(promptArgs[0].choices).toEqual([
			{ name: "alice", value: "alice" },
			{ name: "alice-deploy", value: "alice-deploy" },
		])
		expect(runCommandMock).toHaveBeenCalledTimes(1)
		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice-deploy",
			localOnly: undefined,
		})
	})

	test("forwards localOnly option to runCommand", async () => {
		await devCommand("node", ["app.js"], { localOnly: true })

		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice",
			localOnly: true,
		})
	})
})

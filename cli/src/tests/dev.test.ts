import { beforeEach, describe, expect, mock, test } from "bun:test"
import { devCommand } from "../commands/dev"

describe("devCommand", () => {
	let runCommandMock: ReturnType<typeof mock>
	let logErrorMock: ReturnType<typeof mock>
	let selectMock: ReturnType<typeof mock>

	beforeEach(() => {
		runCommandMock = mock(() => Promise.resolve())
		logErrorMock = mock((_message: string) => {})
		selectMock = mock(
			(_message: string, _choices: { name: string; value: string }[]) =>
				Promise.resolve(""),
		)
	})

	test("delegates to runCommand with development,<keyName>", async () => {
		const exit = (code: number): never => {
			throw new Error(`Unexpected process.exit(${code})`)
		}
		const runCommand = ((...args: unknown[]) =>
			runCommandMock(...args)) as typeof import("../commands/run").runCommand
		const logError = ((message: string) => logErrorMock(message)) as (
			message: string,
		) => void

		await devCommand("node", ["app.js"], {
			getCurrentKeyName: async () => ["alice"],
			runCommand,
			logError,
			exit,
			select: selectMock as typeof selectMock & (<T>(message: string, choices: { name: string; value: T }[]) => Promise<T>),
		})

		expect(runCommandMock).toHaveBeenCalledTimes(1)
		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice",
		})
		expect(logErrorMock).not.toHaveBeenCalled()
		expect(selectMock).not.toHaveBeenCalled()
	})

	test("prints error when no identity is found", async () => {
		const exitMock = mock((code: number): never => {
			throw new Error(`process.exit(${code})`)
		})
		const runCommand = ((...args: unknown[]) =>
			runCommandMock(...args)) as typeof import("../commands/run").runCommand
		const logError = ((message: string) => logErrorMock(message)) as (
			message: string,
		) => void

		await expect(
			devCommand("node", ["app.js"], {
				getCurrentKeyName: async () => [],
				runCommand,
				logError,
				exit: exitMock,
				select: selectMock as typeof selectMock & (<T>(message: string, choices: { name: string; value: T }[]) => Promise<T>),
			}),
		).rejects.toThrow("process.exit(1)")

		expect(runCommandMock).not.toHaveBeenCalled()
		expect(exitMock).toHaveBeenCalledWith(1)
		expect(logErrorMock).toHaveBeenCalledTimes(1)
		const [errorMessage] = logErrorMock.mock.calls[0]
		expect(errorMessage).toContain("could not resolve your identity")
	})

	test("prompts user to select identity when multiple keys match", async () => {
		const exit = (code: number): never => {
			throw new Error(`Unexpected process.exit(${code})`)
		}
		const runCommand = ((...args: unknown[]) =>
			runCommandMock(...args)) as typeof import("../commands/run").runCommand
		const logError = ((message: string) => logErrorMock(message)) as (
			message: string,
		) => void

		const selectForTest = mock(
			(_message: string, _choices: { name: string; value: string }[]) =>
				Promise.resolve("alice-deploy"),
		)

		await devCommand("node", ["app.js"], {
			getCurrentKeyName: async () => ["alice", "alice-deploy"],
			runCommand,
			logError,
			exit,
			select: selectForTest as typeof selectForTest & (<T>(message: string, choices: { name: string; value: T }[]) => Promise<T>),
		})

		expect(selectForTest).toHaveBeenCalledTimes(1)
		expect(selectForTest.mock.calls[0][0]).toContain("Multiple identities")
		expect(selectForTest.mock.calls[0][1]).toEqual([
			{ name: "alice", value: "alice" },
			{ name: "alice-deploy", value: "alice-deploy" },
		])
		expect(runCommandMock).toHaveBeenCalledTimes(1)
		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice-deploy",
		})
	})
})

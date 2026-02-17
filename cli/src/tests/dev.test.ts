import { beforeEach, describe, expect, mock, test } from "bun:test"
import { devCommand } from "../commands/dev"

describe("devCommand", () => {
	let runCommandMock: ReturnType<typeof mock>
	let logErrorMock: ReturnType<typeof mock>

	beforeEach(() => {
		runCommandMock = mock(() => Promise.resolve())
		logErrorMock = mock(() => {})
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
			getCurrentKeyName: async () => "alice",
			runCommand,
			logError,
			exit,
		})

		expect(runCommandMock).toHaveBeenCalledTimes(1)
		expect(runCommandMock).toHaveBeenCalledWith("node", ["app.js"], {
			env: "development,alice",
		})
		expect(logErrorMock).not.toHaveBeenCalled()
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
				getCurrentKeyName: async () => undefined,
				runCommand,
				logError,
				exit: exitMock,
			}),
		).rejects.toThrow("process.exit(1)")

		expect(runCommandMock).not.toHaveBeenCalled()
		expect(exitMock).toHaveBeenCalledWith(1)
		expect(logErrorMock).toHaveBeenCalledTimes(1)
		const errorMessage = logErrorMock.mock.calls[0][0] as string
		expect(errorMessage).toContain("could not resolve your identity")
	})
})

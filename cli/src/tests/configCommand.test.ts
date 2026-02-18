import { describe, expect, mock, test } from "bun:test"
import { configCommand } from "../commands/config"

type ConfigCommandDeps = NonNullable<Parameters<typeof configCommand>[3]>

describe("configCommand", () => {
	test("sets supported config key", async () => {
		const setHomeConfig = mock(async (_config: object) => {})

		const deps: ConfigCommandDeps = {
			getHomeConfig: async () => ({}),
			setHomeConfig,
			log: mock((_message: string) => {}),
			logError: mock((_message: string) => {}),
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		}

		await configCommand("editor", "vim", { remove: false }, deps)

		expect(setHomeConfig).toHaveBeenCalledTimes(1)
		expect(setHomeConfig).toHaveBeenCalledWith({ editor: "vim" })
	})

	test("reads supported config key", async () => {
		const log = mock((_message: string) => {})

		const deps: ConfigCommandDeps = {
			getHomeConfig: async () => ({ editor: "nano" }),
			setHomeConfig: mock(async (_config: object) => {}),
			log,
			logError: mock((_message: string) => {}),
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		}

		await configCommand("editor", undefined, { remove: false }, deps)

		expect(log).toHaveBeenCalledWith("nano")
	})

	test("removes supported config key", async () => {
		const setHomeConfig = mock(async (_config: object) => {})

		const deps: ConfigCommandDeps = {
			getHomeConfig: async () => ({ editor: "code" }),
			setHomeConfig,
			log: mock((_message: string) => {}),
			logError: mock((_message: string) => {}),
			exit: mock((code: number): never => {
				throw new Error(`exit(${code})`)
			}),
		}

		await configCommand("editor", undefined, { remove: true }, deps)

		expect(setHomeConfig).toHaveBeenCalledWith({})
	})

	test("rejects unsupported config keys", async () => {
		const logError = mock((_message: string) => {})
		const exit = mock((code: number): never => {
			throw new Error(`exit(${code})`)
		})

		const deps: ConfigCommandDeps = {
			getHomeConfig: async () => ({}),
			setHomeConfig: mock(async (_config: object) => {}),
			log: mock((_message: string) => {}),
			logError,
			exit,
		}

		await expect(
			configCommand("unknown", "value", { remove: false }, deps),
		).rejects.toThrow("exit(1)")

		expect(logError).toHaveBeenCalledTimes(1)
		expect(String(logError.mock.calls[0][0])).toContain(
			'unsupported config key "unknown"',
		)
		expect(exit).toHaveBeenCalledWith(1)
	})
})

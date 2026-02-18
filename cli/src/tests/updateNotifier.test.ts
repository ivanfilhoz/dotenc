import { describe, expect, test } from "bun:test"
import { maybeNotifyAboutUpdate } from "../helpers/updateNotifier"

type UpdateConfig = {
	lastCheckedAt?: string | null
	latestVersion?: string | null
	notifiedVersion?: string | null
}

describe("maybeNotifyAboutUpdate", () => {
	test("logs update notice and persists notified version", async () => {
		let config: { update?: UpdateConfig | null; editor?: string | null } = {}
		const logs: string[] = []

		await maybeNotifyAboutUpdate({
			args: ["whoami"],
			env: {} as NodeJS.ProcessEnv,
			currentVersion: "0.5.0",
			now: () => Date.parse("2026-02-18T12:00:00.000Z"),
			getHomeConfig: async () => config,
			setHomeConfig: async (next) => {
				config = next
			},
			fetchLatestVersion: async () => "0.6.0",
			log: (message: string) => {
				logs.push(message)
			},
		})

		expect(logs).toHaveLength(1)
		expect(logs[0]).toContain("dotenc update")
		expect(config.update?.notifiedVersion).toBe("0.6.0")
		expect(config.update?.latestVersion).toBe("0.6.0")
	})

	test("skips checks for update command itself", async () => {
		let fetchCalls = 0

		await maybeNotifyAboutUpdate({
			args: ["update"],
			env: {} as NodeJS.ProcessEnv,
			currentVersion: "0.5.0",
			getHomeConfig: async () => ({}),
			setHomeConfig: async () => {},
			fetchLatestVersion: async () => {
				fetchCalls += 1
				return "0.6.0"
			},
			log: () => {},
		})

		expect(fetchCalls).toBe(0)
	})

	test("uses cached latest version when check interval has not elapsed", async () => {
		let fetchCalls = 0
		const logs: string[] = []
		const now = Date.parse("2026-02-18T12:00:00.000Z")
		const checkedRecently = new Date(now - 60 * 1000).toISOString()

		await maybeNotifyAboutUpdate({
			args: ["whoami"],
			env: {} as NodeJS.ProcessEnv,
			currentVersion: "0.5.0",
			now: () => now,
			getHomeConfig: async () => ({
				update: {
					lastCheckedAt: checkedRecently,
					latestVersion: "0.6.0",
				},
			}),
			setHomeConfig: async () => {},
			fetchLatestVersion: async () => {
				fetchCalls += 1
				return "0.7.0"
			},
			log: (message: string) => {
				logs.push(message)
			},
		})

		expect(fetchCalls).toBe(0)
		expect(logs).toHaveLength(1)
		expect(logs[0]).toContain("0.6.0")
	})

	test("does not log when latest version is already notified", async () => {
		const logs: string[] = []

		await maybeNotifyAboutUpdate({
			args: ["whoami"],
			env: {} as NodeJS.ProcessEnv,
			currentVersion: "0.5.0",
			now: () => Date.parse("2026-02-18T12:00:00.000Z"),
			getHomeConfig: async () => ({
				update: {
					lastCheckedAt: "2026-02-18T11:59:00.000Z",
					latestVersion: "0.6.0",
					notifiedVersion: "0.6.0",
				},
			}),
			setHomeConfig: async () => {},
			fetchLatestVersion: async () => "0.6.0",
			log: (message: string) => {
				logs.push(message)
			},
		})

		expect(logs).toHaveLength(0)
	})
})

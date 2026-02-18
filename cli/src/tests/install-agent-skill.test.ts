import { beforeEach, describe, expect, mock, test } from "bun:test"
import { EventEmitter } from "node:events"
import {
	_runInstallAgentSkillCommand,
	_runNpx,
} from "../commands/tools/install-agent-skill"

describe("installAgentSkillCommand", () => {
	let prompt: ReturnType<typeof mock>
	let runNpx: ReturnType<typeof mock>
	let log: ReturnType<typeof mock>
	let logError: ReturnType<typeof mock>

	beforeEach(() => {
		prompt = mock(async () => ({ scope: "local" }))
		runNpx = mock(async () => 0)
		log = mock((_message: string) => {})
		logError = mock((_message: string) => {})
	})

	test("runs npx skills add for local installation", async () => {
		await _runInstallAgentSkillCommand(
			{},
			{
				prompt: prompt as never,
				runNpx,
				log,
				logError,
				exit: (code: number): never => {
					throw new Error(`unexpected exit(${code})`)
				},
			},
		)

		expect(runNpx).toHaveBeenCalledWith([
			"skills",
			"add",
			"ivanfilhoz/dotenc",
			"--skill",
			"dotenc",
		])
		expect(
			log.mock.calls.some((call) => String(call[0]).includes("/dotenc")),
		).toBe(true)
	})

	test("adds -g for global installation", async () => {
		prompt = mock(async () => ({ scope: "global" }))

		await _runInstallAgentSkillCommand(
			{},
			{
				prompt: prompt as never,
				runNpx,
				log,
				logError,
				exit: (code: number): never => {
					throw new Error(`unexpected exit(${code})`)
				},
			},
		)

		expect(runNpx).toHaveBeenCalledWith([
			"skills",
			"add",
			"ivanfilhoz/dotenc",
			"--skill",
			"dotenc",
			"-g",
		])
	})

	test("adds -y when --force is used", async () => {
		await _runInstallAgentSkillCommand(
			{ force: true },
			{
				prompt: prompt as never,
				runNpx,
				log,
				logError,
				exit: (code: number): never => {
					throw new Error(`unexpected exit(${code})`)
				},
			},
		)

		expect(runNpx).toHaveBeenCalledWith([
			"skills",
			"add",
			"ivanfilhoz/dotenc",
			"--skill",
			"dotenc",
			"-y",
		])
	})

	test("exits with updater exit code when npx returns non-zero", async () => {
		runNpx = mock(async () => 7)

		await expect(
			_runInstallAgentSkillCommand(
				{},
				{
					prompt: prompt as never,
					runNpx,
					log,
					logError,
					exit: (code: number): never => {
						throw new Error(`exit(${code})`)
					},
				},
			),
		).rejects.toThrow("exit(7)")
	})

	test("exits with code 1 when npx command cannot be started", async () => {
		runNpx = mock(async () => {
			throw new Error("spawn ENOENT")
		})

		await expect(
			_runInstallAgentSkillCommand(
				{},
				{
					prompt: prompt as never,
					runNpx,
					log,
					logError,
					exit: (code: number): never => {
						throw new Error(`exit(${code})`)
					},
				},
			),
		).rejects.toThrow("exit(1)")
	})
})

describe("_runNpx", () => {
	test("resolves with exit code when npx exits successfully", async () => {
		const child = new EventEmitter()
		const spawnImpl = mock(() => {
			queueMicrotask(() => child.emit("exit", 0))
			return child as never
		})

		const result = await _runNpx(["--version"], spawnImpl as never)
		expect(result).toBe(0)
		expect(spawnImpl).toHaveBeenCalled()
	})

	test("rejects when npx process emits an error", async () => {
		const child = new EventEmitter()
		const spawnImpl = mock(() => {
			queueMicrotask(() => child.emit("error", new Error("spawn ENOENT")))
			return child as never
		})

		await expect(
			_runNpx(["skills", "add"], spawnImpl as never),
		).rejects.toThrow("spawn ENOENT")
	})
})

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import inquirer from "inquirer"
import { installAgentSkillCommand } from "../commands/tools/install-agent-skill"

describe("installAgentSkillCommand", () => {
	let tmpDir: string
	let cwdSpy: ReturnType<typeof spyOn>
	let homeSpy: ReturnType<typeof spyOn>
	let promptSpy: ReturnType<typeof spyOn>
	let logSpy: ReturnType<typeof spyOn>
	let errorSpy: ReturnType<typeof spyOn>
	let exitSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-skill-"))
		cwdSpy = spyOn(process, "cwd").mockReturnValue(tmpDir)
		homeSpy = spyOn(os, "homedir").mockReturnValue(tmpDir)
		logSpy = spyOn(console, "log").mockImplementation(() => {})
		errorSpy = spyOn(console, "error").mockImplementation(() => {})
		exitSpy = spyOn(process, "exit").mockImplementation(((code: number) => {
			throw new Error(`exit(${code})`)
		}) as never)
		promptSpy = spyOn(inquirer, "prompt").mockResolvedValue({
			scope: "local",
		} as never)
	})

	afterEach(() => {
		cwdSpy.mockRestore()
		homeSpy.mockRestore()
		logSpy.mockRestore()
		errorSpy.mockRestore()
		exitSpy.mockRestore()
		promptSpy.mockRestore()
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("installs locally and writes SKILL.md under .claude/", async () => {
		await installAgentSkillCommand({})

		const skillPath = path.join(
			tmpDir,
			".claude",
			"skills",
			"dotenc",
			"SKILL.md",
		)
		expect(existsSync(skillPath)).toBe(true)
		const content = readFileSync(skillPath, "utf-8")
		expect(content).toContain("name: dotenc")
	})

	test("installs globally under ~/.claude/", async () => {
		promptSpy.mockResolvedValue({ scope: "global" } as never)

		await installAgentSkillCommand({})

		// homedir is mocked to tmpDir, so global path is also under tmpDir
		const skillPath = path.join(
			tmpDir,
			".claude",
			"skills",
			"dotenc",
			"SKILL.md",
		)
		expect(existsSync(skillPath)).toBe(true)
	})

	test("prints success message with installed path", async () => {
		await installAgentSkillCommand({})

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("Agent skill installed")
		expect(allLogs).toContain(".claude")
	})

	test("prints /dotenc usage hint after install", async () => {
		await installAgentSkillCommand({})

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("/dotenc")
	})

	test("errors when SKILL.md already exists without --force", async () => {
		await installAgentSkillCommand({})

		await expect(installAgentSkillCommand({})).rejects.toThrow("exit(1)")
		const allErrors = errorSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allErrors).toContain("already exists")
		expect(allErrors).toContain("--force")
	})

	test("overwrites when SKILL.md exists with --force", async () => {
		await installAgentSkillCommand({})
		await installAgentSkillCommand({ force: true })

		const skillPath = path.join(
			tmpDir,
			".claude",
			"skills",
			"dotenc",
			"SKILL.md",
		)
		expect(existsSync(skillPath)).toBe(true)
		expect(exitSpy).not.toHaveBeenCalled()
	})
})

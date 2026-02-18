import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateEd25519Key, runCli, runCliWithStdin } from "../helpers/cli"

const TIMEOUT = 30_000

describe("tools install-claude-code-skill", () => {
	let home: string
	let workspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-18-skill-home-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-18-skill-ws-"))
		generateEd25519Key(home)
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
	})

	test("installs SKILL.md locally when first option selected", () => {
		// Send newline to select first option ("Locally") in the list prompt
		const result = runCliWithStdin(
			home,
			workspace,
			["tools", "install-claude-code-skill"],
			"\n",
		)
		expect(result.exitCode).toBe(0)
		const skillPath = path.join(workspace, ".claude", "skills", "dotenc", "SKILL.md")
		expect(existsSync(skillPath)).toBe(true)
		expect(result.stdout).toContain("Claude Code skill installed")
	}, TIMEOUT)

	test("errors when SKILL.md already exists without --force", () => {
		const result = runCliWithStdin(
			home,
			workspace,
			["tools", "install-claude-code-skill"],
			"\n",
		)
		expect(result.exitCode).toBe(1)
		expect(result.stderr).toContain("already exists")
		expect(result.stderr).toContain("--force")
	}, TIMEOUT)

	test("overwrites existing SKILL.md with --force", () => {
		const result = runCliWithStdin(
			home,
			workspace,
			["tools", "install-claude-code-skill", "--force"],
			"\n",
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Claude Code skill installed")
	}, TIMEOUT)
})

describe("tools install-vscode-extension", () => {
	let home: string
	let workspace: string
	let freshWorkspace: string

	beforeAll(() => {
		home = mkdtempSync(path.join(os.tmpdir(), "e2e-18-vscode-home-"))
		workspace = mkdtempSync(path.join(os.tmpdir(), "e2e-18-vscode-ws-"))
		freshWorkspace = mkdtempSync(path.join(os.tmpdir(), "e2e-18-vscode-fresh-"))
		generateEd25519Key(home)
	})

	afterAll(() => {
		rmSync(home, { recursive: true, force: true })
		rmSync(workspace, { recursive: true, force: true })
		rmSync(freshWorkspace, { recursive: true, force: true })
	})

	test("creates .vscode/extensions.json with dotenc recommendation", () => {
		const result = runCli(home, workspace, ["tools", "install-vscode-extension"])
		expect(result.exitCode).toBe(0)

		const jsonPath = path.join(workspace, ".vscode", "extensions.json")
		expect(existsSync(jsonPath)).toBe(true)

		const json = JSON.parse(
			require("node:fs").readFileSync(jsonPath, "utf-8"),
		)
		expect(json.recommendations).toContain("dotenc.dotenc")
	}, TIMEOUT)

	test("is idempotent — no duplicate on second run", () => {
		runCli(home, workspace, ["tools", "install-vscode-extension"])

		const jsonPath = path.join(workspace, ".vscode", "extensions.json")
		const json = JSON.parse(
			require("node:fs").readFileSync(jsonPath, "utf-8"),
		)
		expect(
			json.recommendations.filter((x: string) => x === "dotenc.dotenc"),
		).toHaveLength(1)
	}, TIMEOUT)

	test("prints fallback VS Code URL when no editor is detected", () => {
		// Uses a fresh workspace with no .vscode/ dir so no editor is detected
		const result = runCli(home, freshWorkspace, ["tools", "install-vscode-extension"])
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("vscode:extension/dotenc.dotenc")
	}, TIMEOUT)
})

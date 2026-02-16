import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { execSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { setupGitDiff } from "../helpers/setupGitDiff"

describe("setupGitDiff", () => {
	let tmpDir: string
	const originalCwd = process.cwd()

	beforeAll(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-gitdiff-"))
		execSync("git init --quiet", { cwd: tmpDir })
		process.chdir(tmpDir)
	})

	afterAll(() => {
		process.chdir(originalCwd)
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test("creates .gitattributes with diff marker", () => {
		setupGitDiff()
		const content = readFileSync(path.join(tmpDir, ".gitattributes"), "utf-8")
		expect(content).toContain("*.enc diff=dotenc")
	})

	test("does not duplicate marker on repeated calls", () => {
		setupGitDiff()
		setupGitDiff()
		const content = readFileSync(path.join(tmpDir, ".gitattributes"), "utf-8")
		const count = content.split("*.enc diff=dotenc").length - 1
		expect(count).toBe(1)
	})

	test("appends marker to existing .gitattributes content", () => {
		const attrPath = path.join(tmpDir, ".gitattributes")
		writeFileSync(attrPath, "*.md linguist-documentation", "utf-8")
		setupGitDiff()
		const content = readFileSync(attrPath, "utf-8")
		expect(content).toContain("*.md linguist-documentation")
		expect(content).toContain("*.enc diff=dotenc")
	})

	test("configures git diff driver", () => {
		setupGitDiff()
		const result = execSync("git config --local diff.dotenc.textconv", {
			cwd: tmpDir,
			encoding: "utf-8",
		}).trim()
		expect(result).toBe("dotenc textconv")
	})
})

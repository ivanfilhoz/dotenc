import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import inquirer from "inquirer"
import { _runInstallVscodeExtension } from "../commands/tools/install-vscode-extension"

describe("installVscodeExtensionCommand", () => {
	let tmpDir: string
	let cwdSpy: ReturnType<typeof spyOn>
	let logSpy: ReturnType<typeof spyOn>
	let promptSpy: ReturnType<typeof spyOn>

	beforeEach(() => {
		tmpDir = mkdtempSync(path.join(os.tmpdir(), "test-vscode-ext-"))
		cwdSpy = spyOn(process, "cwd").mockReturnValue(tmpDir)
		logSpy = spyOn(console, "log").mockImplementation(() => {})
		promptSpy = spyOn(inquirer, "prompt").mockResolvedValue({
			open: false,
		} as never)
	})

	afterEach(() => {
		cwdSpy.mockRestore()
		logSpy.mockRestore()
		promptSpy.mockRestore()
		rmSync(tmpDir, { recursive: true, force: true })
	})

	// extensions.json management

	test("creates .vscode/extensions.json with recommendation when file is absent", async () => {
		await _runInstallVscodeExtension(async () => [])

		const jsonPath = path.join(tmpDir, ".vscode", "extensions.json")
		expect(existsSync(jsonPath)).toBe(true)
		const json = JSON.parse(readFileSync(jsonPath, "utf-8"))
		expect(json.recommendations).toContain("dotenc.dotenc")
	})

	test("appends to existing extensions.json without removing other entries", async () => {
		mkdirSync(path.join(tmpDir, ".vscode"), { recursive: true })
		writeFileSync(
			path.join(tmpDir, ".vscode", "extensions.json"),
			JSON.stringify({ recommendations: ["other.extension"] }),
		)

		await _runInstallVscodeExtension(async () => [])

		const json = JSON.parse(
			readFileSync(path.join(tmpDir, ".vscode", "extensions.json"), "utf-8"),
		)
		expect(json.recommendations).toContain("dotenc.dotenc")
		expect(json.recommendations).toContain("other.extension")
	})

	test("does not duplicate if dotenc.dotenc already in recommendations", async () => {
		mkdirSync(path.join(tmpDir, ".vscode"), { recursive: true })
		writeFileSync(
			path.join(tmpDir, ".vscode", "extensions.json"),
			JSON.stringify({ recommendations: ["dotenc.dotenc"] }),
		)

		await _runInstallVscodeExtension(async () => [])

		const json = JSON.parse(
			readFileSync(path.join(tmpDir, ".vscode", "extensions.json"), "utf-8"),
		)
		expect(
			json.recommendations.filter((x: string) => x === "dotenc.dotenc"),
		).toHaveLength(1)
	})

	test("recovers gracefully from malformed extensions.json", async () => {
		mkdirSync(path.join(tmpDir, ".vscode"), { recursive: true })
		writeFileSync(
			path.join(tmpDir, ".vscode", "extensions.json"),
			"not valid json{{{",
		)

		await _runInstallVscodeExtension(async () => [])

		const json = JSON.parse(
			readFileSync(path.join(tmpDir, ".vscode", "extensions.json"), "utf-8"),
		)
		expect(json.recommendations).toContain("dotenc.dotenc")
	})

	test("handles missing recommendations key in existing file", async () => {
		mkdirSync(path.join(tmpDir, ".vscode"), { recursive: true })
		writeFileSync(
			path.join(tmpDir, ".vscode", "extensions.json"),
			JSON.stringify({ unwantedKey: true }),
		)

		await _runInstallVscodeExtension(async () => [])

		const json = JSON.parse(
			readFileSync(path.join(tmpDir, ".vscode", "extensions.json"), "utf-8"),
		)
		expect(json.recommendations).toContain("dotenc.dotenc")
	})

	// Editor detection + URL handling

	test("prints VS Code fallback URL when no editors detected", async () => {
		await _runInstallVscodeExtension(async () => [])

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("vscode:extension/dotenc.dotenc")
	})

	test("prompts to open when exactly one editor detected", async () => {
		await _runInstallVscodeExtension(async () => ["cursor"])

		expect(promptSpy).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ name: "open" })]),
		)
	})

	test("prints install URL when user declines to open", async () => {
		promptSpy.mockResolvedValue({ open: false } as never)

		await _runInstallVscodeExtension(async () => ["cursor"])

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("cursor:extension/dotenc.dotenc")
	})

	test("calls openUrl when user confirms open", async () => {
		promptSpy.mockResolvedValue({ open: true } as never)
		const fakeOpen = mock(async (_url: string) => {})

		await _runInstallVscodeExtension(async () => ["vscode"], fakeOpen)

		expect(fakeOpen).toHaveBeenCalledWith("vscode:extension/dotenc.dotenc")
	})

	test("falls back to print URL if openUrl throws", async () => {
		promptSpy.mockResolvedValue({ open: true } as never)
		const failingOpen = mock(async (_url: string) => {
			throw new Error("open failed")
		})

		await _runInstallVscodeExtension(async () => ["windsurf"], failingOpen)

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("windsurf:extension/dotenc.dotenc")
		expect(allLogs).toContain("Open manually")
	})

	test("prints all editor URLs when multiple editors detected", async () => {
		await _runInstallVscodeExtension(async () => ["vscode", "cursor"])

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("vscode:extension/dotenc.dotenc")
		expect(allLogs).toContain("cursor:extension/dotenc.dotenc")
		expect(promptSpy).not.toHaveBeenCalled()
	})

	test("uses editor key as name fallback for unknown editors", async () => {
		// Pass an editor key that has no entry in EDITOR_NAMES
		await _runInstallVscodeExtension(async () => ["vscode", "unknown-editor"])

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("unknown-editor")
	})

	// detectEditors integration (real implementation, project dirs)

	test("detectEditors: detects editors via project directories", async () => {
		mkdirSync(path.join(tmpDir, ".cursor"), { recursive: true })
		mkdirSync(path.join(tmpDir, ".vscode"), { recursive: true })

		// Run with real detectEditors — multiple editors found, no prompt
		await _runInstallVscodeExtension()

		const allLogs = logSpy.mock.calls
			.map((c: unknown[]) => String(c[0]))
			.join("\n")
		expect(allLogs).toContain("cursor:extension/dotenc.dotenc")
		expect(allLogs).toContain("vscode:extension/dotenc.dotenc")
	})
})

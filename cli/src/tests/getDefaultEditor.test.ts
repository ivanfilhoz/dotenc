import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { getDefaultEditor } from "../helpers/getDefaultEditor"

describe("getDefaultEditor", () => {
	const originalEditor = process.env.EDITOR
	const originalVisual = process.env.VISUAL

	beforeEach(() => {
		delete process.env.EDITOR
		delete process.env.VISUAL
	})

	afterAll(() => {
		if (originalEditor) process.env.EDITOR = originalEditor
		else delete process.env.EDITOR
		if (originalVisual) process.env.VISUAL = originalVisual
		else delete process.env.VISUAL
	})

	test("returns config editor when set", async () => {
		const editor = await getDefaultEditor({
			getHomeConfig: async () => ({ editor: "code" }),
			commandExists: () => false,
			platform: "linux",
		})
		expect(editor).toBe("code")
	})

	test("returns EDITOR env var when config has no editor", async () => {
		process.env.EDITOR = "vim"

		const editor = await getDefaultEditor({
			getHomeConfig: async () => ({}),
			commandExists: () => false,
			platform: "linux",
		})
		expect(editor).toBe("vim")
	})

	test("returns VISUAL env var when EDITOR is not set", async () => {
		process.env.VISUAL = "nano"

		const editor = await getDefaultEditor({
			getHomeConfig: async () => ({}),
			commandExists: () => false,
			platform: "linux",
		})
		expect(editor).toBe("nano")
	})

	test("falls back to system editor on macOS/Linux", async () => {
		const editor = await getDefaultEditor({
			getHomeConfig: async () => ({}),
			commandExists: (command) => command === "vim",
			platform: "linux",
		})
		expect(editor).toBe("vim")
	})
})

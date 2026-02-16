import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"

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
		mock.module("../helpers/homeConfig", () => ({
			getHomeConfig: () => Promise.resolve({ editor: "code" }),
		}))

		const { getDefaultEditor } = await import("../helpers/getDefaultEditor")
		const editor = await getDefaultEditor()
		expect(editor).toBe("code")
	})

	test("returns EDITOR env var when config has no editor", async () => {
		mock.module("../helpers/homeConfig", () => ({
			getHomeConfig: () => Promise.resolve({}),
		}))

		process.env.EDITOR = "vim"

		const { getDefaultEditor } = await import("../helpers/getDefaultEditor")
		const editor = await getDefaultEditor()
		expect(editor).toBe("vim")
	})

	test("returns VISUAL env var when EDITOR is not set", async () => {
		mock.module("../helpers/homeConfig", () => ({
			getHomeConfig: () => Promise.resolve({}),
		}))

		process.env.VISUAL = "nano"

		const { getDefaultEditor } = await import("../helpers/getDefaultEditor")
		const editor = await getDefaultEditor()
		expect(editor).toBe("nano")
	})

	test("falls back to system editor on macOS/Linux", async () => {
		mock.module("../helpers/homeConfig", () => ({
			getHomeConfig: () => Promise.resolve({}),
		}))

		const { getDefaultEditor } = await import("../helpers/getDefaultEditor")
		const editor = await getDefaultEditor()
		// On a typical dev machine, at least one of nano/vim/vi should exist
		expect(["nano", "vim", "vi"]).toContain(editor)
	})
})

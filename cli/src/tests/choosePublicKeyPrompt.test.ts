import { describe, expect, mock, test } from "bun:test"
import { _runChoosePublicKeyPrompt } from "../prompts/choosePublicKey"

describe("choosePublicKeyPrompt", () => {
	test("uses list prompt for single key selection", async () => {
		const prompt = mock(async (_questions: unknown) => ({ key: "ivan" }))
		const getPublicKeys = mock(async () => [{ name: "ivan.pub" }] as never)

		const selected = await _runChoosePublicKeyPrompt("Pick a key", false, {
			prompt: prompt as never,
			getPublicKeys: getPublicKeys as never,
		})

		expect(selected).toBe("ivan")
		expect(prompt).toHaveBeenCalledTimes(1)
		const [question] = prompt.mock.calls[0][0] as Array<{
			type: string
			choices: string[]
		}>
		expect(question.type).toBe("list")
		expect(question.choices).toEqual(["ivan"])
	})

	test("uses checkbox prompt for multiple key selection", async () => {
		const prompt = mock(async (_questions: unknown) => ({
			key: ["ivan", "alice"],
		}))
		const getPublicKeys = mock(
			async () => [{ name: "ivan.pub" }, { name: "alice.pub" }] as never,
		)

		const selected = await _runChoosePublicKeyPrompt("Pick keys", true, {
			prompt: prompt as never,
			getPublicKeys: getPublicKeys as never,
		})

		expect(selected).toEqual(["ivan", "alice"])
		expect(prompt).toHaveBeenCalledTimes(1)
		const [question] = prompt.mock.calls[0][0] as Array<{
			type: string
			choices: string[]
		}>
		expect(question.type).toBe("checkbox")
		expect(question.choices).toEqual(["ivan", "alice"])
	})

	test("normalizes single selection into array when multiple=true", async () => {
		const prompt = mock(async (_questions: unknown) => ({ key: "ivan" }))
		const getPublicKeys = mock(async () => [{ name: "ivan.pub" }] as never)

		const selected = await _runChoosePublicKeyPrompt("Pick keys", true, {
			prompt: prompt as never,
			getPublicKeys: getPublicKeys as never,
		})

		expect(selected).toEqual(["ivan"])
	})

	test("returns first item when single mode receives array response", async () => {
		const prompt = mock(async (_questions: unknown) => ({
			key: ["ivan", "alice"],
		}))
		const getPublicKeys = mock(
			async () => [{ name: "ivan.pub" }, { name: "alice.pub" }] as never,
		)

		const selected = await _runChoosePublicKeyPrompt("Pick key", false, {
			prompt: prompt as never,
			getPublicKeys: getPublicKeys as never,
		})

		expect(selected).toBe("ivan")
	})

	test("multiple selection validator enforces at least one key", async () => {
		let capturedQuestions: Array<{ validate?: (input: unknown) => unknown }> =
			[]
		const prompt = mock(async (questions: unknown) => {
			capturedQuestions = questions as Array<{
				validate?: (input: unknown) => unknown
			}>
			return { key: ["ivan"] }
		})
		const getPublicKeys = mock(async () => [{ name: "ivan.pub" }] as never)

		await _runChoosePublicKeyPrompt("Pick keys", true, {
			prompt: prompt as never,
			getPublicKeys: getPublicKeys as never,
		})

		const validate = capturedQuestions[0]?.validate
		expect(typeof validate).toBe("function")
		if (!validate) {
			throw new Error("Expected validate callback to be present")
		}
		expect(validate(["ivan"])).toBe(true)
		expect(validate([])).toBe("Select at least one public key.")
	})
})

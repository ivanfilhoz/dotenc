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
})

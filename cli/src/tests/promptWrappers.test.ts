import { describe, expect, spyOn, test } from "bun:test"
import inquirer from "inquirer"
import { _runChooseEnvironmentPrompt } from "../prompts/chooseEnvironment"
import { createEnvironmentPrompt } from "../prompts/createEnvironment"
import { inputKeyPrompt } from "../prompts/inputKey"
import { inputNamePrompt } from "../prompts/inputName"

describe("prompt wrappers", () => {
	test("inputNamePrompt sanitizes with allowed characters and lowercase", async () => {
		let capturedQuestions: Array<Record<string, unknown>> = []
		const promptSpy = spyOn(inquirer as never, "prompt").mockImplementation(
			(async (questions: unknown) => {
				capturedQuestions = questions as Array<Record<string, unknown>>
				return { name: "final_name" } as never
			}) as never,
		)

		const name = await inputNamePrompt("Your name?", "default-user")
		expect(name).toBe("final_name")
		expect(promptSpy).toHaveBeenCalledTimes(1)

		const [question] = capturedQuestions
		expect(question?.type).toBe("input")
		expect(question?.name).toBe("name")
		expect(question?.message).toBe("Your name?")
		expect(question?.default).toBe("default-user")

		const filter = question?.filter as (input: string) => string
		expect(filter("  Alice! Name_Dev-01  ")).toBe("alicename_dev-01")
		promptSpy.mockRestore()
	})

	test("inputKeyPrompt uses password prompt with mask", async () => {
		let capturedQuestions: Array<Record<string, unknown>> = []
		const promptSpy = spyOn(inquirer as never, "prompt").mockImplementation(
			(async (questions: unknown) => {
				capturedQuestions = questions as Array<Record<string, unknown>>
				return { key: "secret" } as never
			}) as never,
		)

		const key = await inputKeyPrompt("Paste key", "default-key")
		expect(key).toBe("secret")
		expect(promptSpy).toHaveBeenCalledTimes(1)

		const [question] = capturedQuestions
		expect(question?.type).toBe("password")
		expect(question?.name).toBe("key")
		expect(question?.mask).toBe("*")
		expect(question?.default).toBe("default-key")
		promptSpy.mockRestore()
	})

	test("createEnvironmentPrompt returns selected environment", async () => {
		let capturedQuestions: Array<Record<string, unknown>> = []
		const promptSpy = spyOn(inquirer as never, "prompt").mockImplementation(
			(async (questions: unknown) => {
				capturedQuestions = questions as Array<Record<string, unknown>>
				return { environment: "staging" } as never
			}) as never,
		)

		const environment = await createEnvironmentPrompt(
			"Environment name?",
			"development",
		)
		expect(environment).toBe("staging")

		const [question] = capturedQuestions
		expect(question?.type).toBe("input")
		expect(question?.name).toBe("environment")
		expect(question?.default).toBe("development")
		promptSpy.mockRestore()
	})

	test("chooseEnvironment helper logs tip when no environments exist", async () => {
		const logs: string[] = []
		let capturedQuestions: Array<Record<string, unknown>> = []

		const selected = await _runChooseEnvironmentPrompt("Pick env", {
			getEnvironments: async () => [],
			logInfo: (message) => logs.push(message),
			prompt: (async (questions: unknown) => {
				capturedQuestions = questions as Array<Record<string, unknown>>
				return { environment: "development" } as never
			}) as never,
		})

		expect(selected).toBe("development")
		expect(logs).toHaveLength(1)
		expect(logs[0]).toContain("No environment files found")
		const [question] = capturedQuestions
		expect(question?.type).toBe("list")
		expect(question?.choices).toEqual([])
	})

	test("chooseEnvironment helper passes discovered choices to prompt", async () => {
		let capturedQuestions: Array<Record<string, unknown>> = []
		const selected = await _runChooseEnvironmentPrompt("Pick environment", {
			getEnvironments: async () => ["dev", "production"],
			logInfo: (_message: string) => {},
			prompt: (async (questions: unknown) => {
				capturedQuestions = questions as Array<Record<string, unknown>>
				return { environment: "dev" } as never
			}) as never,
		})

		expect(selected).toBe("dev")
		const [question] = capturedQuestions
		expect(question?.choices).toEqual(["dev", "production"])
	})
})

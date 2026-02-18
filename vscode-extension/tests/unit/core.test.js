const { describe, expect, test } = require("bun:test")
const { formatDetectedVersion } = require("../../src/helpers/formatDetectedVersion")
const { getFailureSteps } = require("../../src/helpers/getFailureSteps")
const { getFailureUserMessage } = require("../../src/helpers/getFailureUserMessage")
const { isVersionSupported } = require("../../src/helpers/isVersionSupported")
const { mapFailureCode } = require("../../src/helpers/mapFailureCode")
const { MIN_DOTENC_VERSION } = require("../../src/helpers/minDotencVersion")
const { parseEnvironmentName } = require("../../src/helpers/parseEnvironmentName")
const { parseJsonPayload } = require("../../src/helpers/parseJsonPayload")
const { stripAnsi } = require("../../src/helpers/stripAnsi")

describe("core helpers", () => {
	test("parses .env.<name>.enc filenames", () => {
		expect(parseEnvironmentName("/repo/.env.development.enc")).toBe(
			"development",
		)
		expect(parseEnvironmentName("/repo/.env.alice.enc")).toBe("alice")
		expect(parseEnvironmentName("/repo/.env")).toBeUndefined()
	})

	test("parses JSON payload only when valid", () => {
		expect(parseJsonPayload('{"ok":true}')).toEqual({ ok: true })
		expect(parseJsonPayload("   ")).toBeUndefined()
		expect(parseJsonPayload("not-json")).toBeUndefined()
	})

	test("strips ANSI escapes", () => {
		expect(stripAnsi("\u001b[31mError:\u001b[0m boom")).toBe("Error: boom")
	})

	test("supports versions >= minimum", () => {
		expect(isVersionSupported("0.5.2", MIN_DOTENC_VERSION)).toBe(true)
		expect(isVersionSupported("0.5.9", MIN_DOTENC_VERSION)).toBe(true)
		expect(isVersionSupported("1.0.0", MIN_DOTENC_VERSION)).toBe(true)
		expect(isVersionSupported("0.5.1", MIN_DOTENC_VERSION)).toBe(false)
		expect(isVersionSupported("v0.5.2", MIN_DOTENC_VERSION)).toBe(true)
		expect(isVersionSupported("invalid", MIN_DOTENC_VERSION)).toBe(false)
	})

	test("extracts normalized detected versions", () => {
		expect(formatDetectedVersion("v0.5.2")).toBe("0.5.2")
		expect(formatDetectedVersion("dotenc version 0.5.0")).toBe("0.5.0")
		expect(formatDetectedVersion("unknown")).toBe("unknown")
	})

	test("maps known failure messages to failure codes", () => {
		expect(
			mapFailureCode(
				'dotenc CLI was not found. Configure "dotenc.executablePath" in VS Code settings or install dotenc.',
			),
		).toBe("CLI_NOT_FOUND")
		expect(mapFailureCode("Access denied to the environment.")).toBe(
			"ACCESS_DENIED",
		)
		expect(
			mapFailureCode("Environment file not found: /tmp/.env.dev.enc"),
		).toBe("ENVIRONMENT_NOT_FOUND")
		expect(mapFailureCode("No public keys found.")).toBe("NO_PUBLIC_KEYS")
		expect(mapFailureCode("random failure")).toBe("UNKNOWN")
	})

	test("access denied user message is explicit and actionable", () => {
		const message = getFailureUserMessage("staging", {
			code: "ACCESS_DENIED",
			message: "Access denied to the environment.",
		})

		expect(message).toContain('You do not have access to "staging".')
		expect(message).toContain('Run "dotenc whoami"')
		expect(message).toContain("grant you this environment")
	})

	test("access denied guidance includes key add and grant commands", () => {
		const steps = getFailureSteps("production", { code: "ACCESS_DENIED" })
		const joined = steps.join("\n")
		expect(joined).toContain("dotenc key add <your-key-name> --from-file")
		expect(joined).toContain("dotenc auth grant production <your-key-name>")
	})

	test("cli-not-found guidance includes executable path setup", () => {
		const steps = getFailureSteps("development", {
			code: "CLI_NOT_FOUND",
		})

		expect(steps.join("\n")).toContain("dotenc.executablePath")
		expect(steps.join("\n")).toContain("Install dotenc CLI")
	})

	test("version unsupported guidance includes minimum version", () => {
		const steps = getFailureSteps("development", {
			code: "CLI_VERSION_UNSUPPORTED",
		})
		expect(steps.join("\n")).toContain(MIN_DOTENC_VERSION)
	})
})

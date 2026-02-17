const path = require("node:path")

const MIN_DOTENC_VERSION = "0.4.6"

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

function parseEnvironmentName(filePath) {
	const baseName = path.basename(filePath)
	const match = /^\.env\.(.+)\.enc$/.exec(baseName)
	if (!match) {
		return undefined
	}
	return match[1]
}

function stripAnsi(value) {
	if (typeof value !== "string") {
		return ""
	}
	return value.replace(ansiPattern, "")
}

function parseJsonPayload(raw) {
	if (typeof raw !== "string") {
		return undefined
	}

	const trimmed = raw.trim()
	if (!trimmed) {
		return undefined
	}

	try {
		return JSON.parse(trimmed)
	} catch {
		return undefined
	}
}

function mapFailureCode(message) {
	if (message.includes("dotenc CLI was not found")) {
		return "CLI_NOT_FOUND"
	}
	if (message.includes("Access denied to the environment.")) {
		return "ACCESS_DENIED"
	}
	if (message.includes("Environment file not found")) {
		return "ENVIRONMENT_NOT_FOUND"
	}
	if (
		message.includes("No private keys found") ||
		message.includes("No matching key found")
	) {
		return "NO_IDENTITY"
	}
	if (message.includes("No public keys found")) {
		return "NO_PUBLIC_KEYS"
	}
	if (message.toLowerCase().includes("passphrase-protected")) {
		return "PASSPHRASE_PROTECTED_KEYS"
	}
	if (message.includes("No project found")) {
		return "PROJECT_NOT_INITIALIZED"
	}
	if (message.includes("Invalid environment name")) {
		return "INVALID_ENVIRONMENT_NAME"
	}
	if (message.includes("requires dotenc >=")) {
		return "CLI_VERSION_UNSUPPORTED"
	}
	return "UNKNOWN"
}

function parseSemver(value) {
	const match = /(\d+)\.(\d+)\.(\d+)/.exec(value)
	if (!match) {
		return undefined
	}

	return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareSemver(left, right) {
	for (let i = 0; i < 3; i++) {
		if (left[i] > right[i]) return 1
		if (left[i] < right[i]) return -1
	}
	return 0
}

function isVersionSupported(version, minimum = MIN_DOTENC_VERSION) {
	const parsedVersion = parseSemver(version)
	const parsedMinimum = parseSemver(minimum)
	if (!parsedVersion || !parsedMinimum) {
		return false
	}

	return compareSemver(parsedVersion, parsedMinimum) >= 0
}

function formatDetectedVersion(rawVersionOutput) {
	const parsed = parseSemver(rawVersionOutput)
	if (!parsed) {
		return "unknown"
	}
	return parsed.join(".")
}

function getFailureUserMessage(environmentName, failure) {
	if (!failure) {
		return "This file cannot be edited right now."
	}

	if (failure.code === "ACCESS_DENIED") {
		return [
			`You do not have access to "${environmentName}".`,
			'Run "dotenc whoami" to check your identity.',
			"Ask a teammate with access to grant you this environment.",
		].join(" ")
	}

	return failure.message
}

function getFailureSteps(environmentName, failure) {
	if (failure?.code === "CLI_NOT_FOUND") {
		return [
			'1. Install dotenc CLI, or set "dotenc.executablePath" in VS Code settings.',
			"2. Reopen this file after configuration.",
		]
	}

	if (failure?.code === "CLI_VERSION_UNSUPPORTED") {
		return [
			`1. Upgrade dotenc CLI to version ${MIN_DOTENC_VERSION} or newer.`,
			'2. Confirm with "dotenc --version".',
			`3. Reopen ".env.${environmentName}.enc".`,
		]
	}

	if (
		failure?.code === "PROJECT_NOT_INITIALIZED" ||
		failure?.code === "NO_PUBLIC_KEYS"
	) {
		return [
			"1. Initialize dotenc in this repository:\n   dotenc init",
			"2. Ensure the required public keys exist in .dotenc/.",
			`3. Reopen ".env.${environmentName}.enc".`,
		]
	}

	if (failure?.code !== "ACCESS_DENIED") {
		return [
			'1. Verify setup with "dotenc whoami".',
			"2. Check your key exists in .dotenc/ and your private key is available in ~/.ssh/.",
		]
	}

	return [
		"1. Verify your identity:",
		"   dotenc whoami",
		"2. If your key is not in the project, ask a teammate to add it:",
		"   dotenc key add <your-key-name> --from-file <your-public-key>",
		"3. Ask a teammate with access to grant your key:",
		`   dotenc auth grant ${environmentName} <your-key-name>`,
		"4. Pull latest changes and reopen this file.",
	]
}

module.exports = {
	MIN_DOTENC_VERSION,
	formatDetectedVersion,
	getFailureSteps,
	getFailureUserMessage,
	isVersionSupported,
	mapFailureCode,
	parseEnvironmentName,
	parseJsonPayload,
	stripAnsi,
}

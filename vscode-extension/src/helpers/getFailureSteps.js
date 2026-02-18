const { MIN_DOTENC_VERSION } = require("./minDotencVersion")

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
	getFailureSteps,
}

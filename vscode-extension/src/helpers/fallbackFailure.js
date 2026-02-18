const { mapFailureCode } = require("./mapFailureCode")
const { stripAnsi } = require("./stripAnsi")

function fallbackFailure(result) {
	if (result.error && result.error.code === "ENOENT") {
		return {
			code: "CLI_NOT_FOUND",
			message:
				'dotenc CLI was not found. Configure "dotenc.executablePath" in VS Code settings or install dotenc.',
		}
	}

	const message = stripAnsi(
		result.stderr.trim() ||
			result.stdout.trim() ||
			"Unknown error occurred while running dotenc.",
	)

	return {
		code: mapFailureCode(message),
		message,
	}
}

module.exports = {
	fallbackFailure,
}

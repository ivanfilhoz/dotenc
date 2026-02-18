const vscode = require("vscode")

function getDotencExecutable(uri) {
	const configured = vscode.workspace
		.getConfiguration("dotenc", uri ?? null)
		.get("executablePath", "dotenc")

	if (typeof configured !== "string") {
		return "dotenc"
	}

	const normalized = configured.trim()
	return normalized.length > 0 ? normalized : "dotenc"
}

module.exports = {
	getDotencExecutable,
}

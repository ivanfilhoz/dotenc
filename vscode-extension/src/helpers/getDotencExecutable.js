const vscode = require("vscode")

function getDotencExecutable(uri) {
	return vscode.workspace
		.getConfiguration("dotenc", uri ?? null)
		.get("executablePath", "dotenc")
}

module.exports = {
	getDotencExecutable,
}

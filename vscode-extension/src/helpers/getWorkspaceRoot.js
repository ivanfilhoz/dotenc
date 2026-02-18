const vscode = require("vscode")

function getWorkspaceRoot(uri) {
	const folder = vscode.workspace.getWorkspaceFolder(uri)
	return folder?.uri.fsPath
}

module.exports = {
	getWorkspaceRoot,
}

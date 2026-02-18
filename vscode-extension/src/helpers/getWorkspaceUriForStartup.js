const vscode = require("vscode")

function getWorkspaceUriForStartup() {
	return vscode.workspace.workspaceFolders?.[0]?.uri
}

module.exports = {
	getWorkspaceUriForStartup,
}

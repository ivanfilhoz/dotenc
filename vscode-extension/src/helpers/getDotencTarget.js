const path = require("node:path")
const vscode = require("vscode")
const { parseEnvironmentName } = require("./parseEnvironmentName")
const { getWorkspaceRoot } = require("./getWorkspaceRoot")
const { toFileUri } = require("./toFileUri")

function getDotencTarget(uri) {
	const fileUri = toFileUri(uri)
	const environmentName = parseEnvironmentName(fileUri.fsPath)
	if (!environmentName) {
		throw vscode.FileSystemError.FileNotFound(
			`Invalid dotenc file name: ${path.basename(fileUri.fsPath)}. Expected format ".env.<environment>.enc".`,
		)
	}

	const workspaceRoot = getWorkspaceRoot(fileUri)
	if (!workspaceRoot) {
		throw vscode.FileSystemError.Unavailable(
			"Could not determine workspace root for this file. Open the containing folder as a VS Code workspace.",
		)
	}

	return {
		uri: fileUri,
		environmentName,
		workspaceRoot,
	}
}

module.exports = {
	getDotencTarget,
}

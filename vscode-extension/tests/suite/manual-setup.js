const vscode = require("vscode")
const path = require("node:path")

exports.run = async () => {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
	if (!workspaceRoot) {
		throw new Error("No workspace folder found")
	}

	const fileUri = vscode.Uri.file(path.join(workspaceRoot, ".env.allowed.enc"))
	const doc = await vscode.workspace.openTextDocument(fileUri)
	await vscode.window.showTextDocument(doc)

	vscode.window.showInformationMessage(
		"dotenc manual test environment ready. Mock CLI is active.",
	)

	// Keep VS Code open until the user closes the window
	return new Promise(() => {})
}

const path = require("node:path")
const vscode = require("vscode")
const { DOTENC_SCHEME } = require("./constants")
const { parseEnvironmentName } = require("./parseEnvironmentName")
const { toFileUri } = require("./toFileUri")

function resolveSourceUri(resource) {
	const candidate =
		resource instanceof vscode.Uri
			? resource
			: vscode.window.activeTextEditor?.document?.uri

	if (!candidate) {
		throw new Error(
			"Select a .env.<environment>.enc file in Explorer or open one in the editor first.",
		)
	}

	const fileUri =
		candidate.scheme === DOTENC_SCHEME ? toFileUri(candidate) : candidate

	if (fileUri.scheme !== "file") {
		throw new Error("dotenc native editor only supports files on disk.")
	}

	if (!parseEnvironmentName(fileUri.fsPath)) {
		throw new Error(
			`Invalid dotenc file name: ${path.basename(fileUri.fsPath)}. Expected format ".env.<environment>.enc".`,
		)
	}

	return fileUri
}

module.exports = {
	resolveSourceUri,
}

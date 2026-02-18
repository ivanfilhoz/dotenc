const vscode = require("vscode")
const { DOTENC_SCHEME } = require("./constants")

function toFileUri(uri) {
	if (uri.scheme === "file") {
		return uri
	}
	if (uri.scheme !== DOTENC_SCHEME) {
		throw vscode.FileSystemError.Unavailable(
			`Unsupported URI scheme: ${uri.scheme}`,
		)
	}

	return uri.with({ scheme: "file" })
}

module.exports = {
	toFileUri,
}

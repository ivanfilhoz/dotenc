const { DOTENC_SCHEME } = require("./constants")
const { parseEnvironmentName } = require("./parseEnvironmentName")
const { toFileUri } = require("./toFileUri")

function shouldShowOpenEncryptedSourceAction(editor) {
	if (!editor || !editor.document) {
		return false
	}

	const uri = editor.document.uri
	if (uri.scheme !== DOTENC_SCHEME) {
		return false
	}

	try {
		return Boolean(parseEnvironmentName(toFileUri(uri).fsPath))
	} catch {
		return false
	}
}

module.exports = {
	shouldShowOpenEncryptedSourceAction,
}

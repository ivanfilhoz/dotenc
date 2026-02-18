const vscode = require("vscode")

async function ensureEnvironmentLanguage(document) {
	if (document.languageId === "dotenv") {
		return document
	}

	try {
		return await vscode.languages.setTextDocumentLanguage(document, "dotenv")
	} catch {
		return document
	}
}

module.exports = {
	ensureEnvironmentLanguage,
}

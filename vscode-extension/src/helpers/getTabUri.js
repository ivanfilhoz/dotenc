const vscode = require("vscode")

function getTabUri(tabInput) {
	if (!tabInput || typeof tabInput !== "object") {
		return undefined
	}
	if (tabInput.uri instanceof vscode.Uri) {
		return tabInput.uri
	}
	return undefined
}

module.exports = {
	getTabUri,
}

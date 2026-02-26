const vscode = require("vscode")
const { AUTO_VIEW_DECRYPTED_SETTING } = require("./constants")

function isAutoViewDecryptedEnabled() {
	return vscode.workspace
		.getConfiguration("dotenc")
		.get(AUTO_VIEW_DECRYPTED_SETTING, true)
}

module.exports = {
	isAutoViewDecryptedEnabled,
}

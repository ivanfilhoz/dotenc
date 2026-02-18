const vscode = require("vscode")
const { AUTO_OPEN_NATIVE_SETTING } = require("./constants")

function isAutoOpenNativeEnabled() {
	return vscode.workspace
		.getConfiguration("dotenc")
		.get(AUTO_OPEN_NATIVE_SETTING, true)
}

module.exports = {
	isAutoOpenNativeEnabled,
}

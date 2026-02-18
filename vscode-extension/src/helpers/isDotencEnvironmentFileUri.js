const { parseEnvironmentName } = require("./parseEnvironmentName")

function isDotencEnvironmentFileUri(uri) {
	return uri?.scheme === "file" && Boolean(parseEnvironmentName(uri.fsPath))
}

module.exports = {
	isDotencEnvironmentFileUri,
}

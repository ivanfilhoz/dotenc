const { DOTENC_SCHEME } = require("./constants")

function toDotencUri(fileUri) {
	return fileUri.with({ scheme: DOTENC_SCHEME })
}

module.exports = {
	toDotencUri,
}

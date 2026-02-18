function shouldSkipCliUpdateCheck() {
	return (
		process.env.DOTENC_VSCODE_TEST === "1" ||
		process.env.DOTENC_SKIP_UPDATE_CHECK === "1"
	)
}

module.exports = {
	shouldSkipCliUpdateCheck,
}

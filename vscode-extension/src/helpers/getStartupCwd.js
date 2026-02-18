function getStartupCwd(workspaceUri) {
	return workspaceUri?.fsPath ?? process.cwd()
}

module.exports = {
	getStartupCwd,
}

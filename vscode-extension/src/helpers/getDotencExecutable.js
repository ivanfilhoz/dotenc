function normalizeExecutablePath(value) {
	if (typeof value !== "string") {
		return "dotenc"
	}

	const normalized = value.trim()
	return normalized.length > 0 ? normalized : "dotenc"
}

function getDotencExecutable(uri, getConfiguredPath) {
	const configured =
		typeof getConfiguredPath === "function"
			? getConfiguredPath(uri)
			: require("vscode")
					.workspace.getConfiguration("dotenc", uri ?? null)
					.get("executablePath", "dotenc")

	return normalizeExecutablePath(configured)
}

module.exports = {
	getDotencExecutable,
	normalizeExecutablePath,
}

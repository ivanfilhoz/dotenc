const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

function stripAnsi(value) {
	if (typeof value !== "string") {
		return ""
	}
	return value.replace(ansiPattern, "")
}

module.exports = {
	stripAnsi,
}

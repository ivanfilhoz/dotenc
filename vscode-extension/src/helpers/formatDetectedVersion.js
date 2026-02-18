const { parseSemver } = require("./parseSemver")

function formatDetectedVersion(rawVersionOutput) {
	const parsed = parseSemver(rawVersionOutput)
	if (!parsed) {
		return "unknown"
	}
	return parsed.join(".")
}

module.exports = {
	formatDetectedVersion,
}

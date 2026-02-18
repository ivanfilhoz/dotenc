const { compareSemver } = require("./compareSemver")
const { parseSemver } = require("./parseSemver")
const { MIN_DOTENC_VERSION } = require("./minDotencVersion")

function isVersionSupported(version, minimum = MIN_DOTENC_VERSION) {
	const parsedVersion = parseSemver(version)
	const parsedMinimum = parseSemver(minimum)
	if (!parsedVersion || !parsedMinimum) {
		return false
	}

	return compareSemver(parsedVersion, parsedMinimum) >= 0
}

module.exports = {
	isVersionSupported,
}

const { compareSemver } = require("./compareSemver")
const { parseSemver } = require("./parseSemver")

function isVersionNewer(candidate, current) {
	const candidateSemver = parseSemver(candidate)
	const currentSemver = parseSemver(current)
	if (!candidateSemver || !currentSemver) {
		return false
	}
	return compareSemver(candidateSemver, currentSemver) > 0
}

module.exports = {
	isVersionNewer,
}

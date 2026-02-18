function parseSemver(value) {
	if (typeof value !== "string") {
		return undefined
	}

	const match = /(\d+)\.(\d+)\.(\d+)/.exec(value)
	if (!match) {
		return undefined
	}

	return [Number(match[1]), Number(match[2]), Number(match[3])]
}

module.exports = {
	parseSemver,
}

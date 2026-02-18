function parseJsonPayload(raw) {
	if (typeof raw !== "string") {
		return undefined
	}

	const trimmed = raw.trim()
	if (!trimmed) {
		return undefined
	}

	try {
		return JSON.parse(trimmed)
	} catch {
		return undefined
	}
}

module.exports = {
	parseJsonPayload,
}

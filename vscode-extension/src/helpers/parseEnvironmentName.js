const path = require("node:path")

function parseEnvironmentName(filePath) {
	const baseName = path.basename(filePath)
	const match = /^\.env\.(.+)\.enc$/.exec(baseName)
	if (!match) {
		return undefined
	}
	return match[1]
}

module.exports = {
	parseEnvironmentName,
}

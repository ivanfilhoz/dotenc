const { DOTENC_INSTALL_SCRIPT_URL } = require("./constants")

function getDotencInstallCommand(platform = process.platform) {
	if (platform === "win32") {
		return undefined
	}

	return {
		download: {
			executable: "curl",
			args: ["-fsSL", DOTENC_INSTALL_SCRIPT_URL],
		},
		install: {
			executable: "sh",
			args: [],
		},
	}
}

module.exports = {
	getDotencInstallCommand,
}

const { DOTENC_INSTALL_SCRIPT_URL } = require("./constants")

function getDotencInstallCommand(platform = process.platform) {
	if (platform === "win32") {
		return undefined
	}

	return {
		executable: "sh",
		args: ["-c", `curl -fsSL ${DOTENC_INSTALL_SCRIPT_URL} | sh`],
	}
}

module.exports = {
	getDotencInstallCommand,
}

const vscode = require("vscode")
const { getTabUri } = require("./getTabUri")

async function closeFileTabs(fileUri) {
	const tabsToClose = []
	const expectedUri = fileUri.toString()

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			const tabUri = getTabUri(tab.input)
			if (!tabUri) {
				continue
			}
			if (tabUri.scheme !== "file") {
				continue
			}
			if (tabUri.toString() !== expectedUri) {
				continue
			}
			tabsToClose.push(tab)
		}
	}

	if (tabsToClose.length > 0) {
		await vscode.window.tabGroups.close(tabsToClose)
	}
}

module.exports = {
	closeFileTabs,
}

const vscode = require("vscode")
const { getDotencExecutable } = require("./helpers/getDotencExecutable")
const { getStartupCwd } = require("./helpers/getStartupCwd")
const {
	getWorkspaceUriForStartup,
} = require("./helpers/getWorkspaceUriForStartup")
const { runProcess } = require("./helpers/runProcess")
const { stripAnsi } = require("./helpers/stripAnsi")

class KeysProvider {
	constructor() {
		this._onDidChangeTreeData = new vscode.EventEmitter()
		this.onDidChangeTreeData = this._onDidChangeTreeData.event

		this._watcher = vscode.workspace.createFileSystemWatcher("**/.dotenc/*.pub")
		this._watcher.onDidCreate(() => this.refresh())
		this._watcher.onDidDelete(() => this.refresh())
		this._watcher.onDidChange(() => this.refresh())
	}

	dispose() {
		this._watcher.dispose()
		this._onDidChangeTreeData.dispose()
	}

	refresh() {
		this._onDidChangeTreeData.fire()
	}

	getTreeItem(element) {
		return element
	}

	async getChildren() {
		const workspaceUri = getWorkspaceUriForStartup()
		if (!workspaceUri) {
			return []
		}

		const executable = getDotencExecutable(workspaceUri)
		const cwd = getStartupCwd(workspaceUri)
		const result = await runProcess(executable, cwd, ["key", "list"])
		if (result.error || result.code !== 0) {
			return []
		}

		const lines = stripAnsi(result.stdout)
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)

		return lines.map((line) => {
			// Output format: "name (algorithm)"
			const match = line.match(/^(.+?)\s+\((.+?)\)$/)
			const name = match ? match[1] : line
			const algorithm = match ? match[2] : undefined

			const item = new vscode.TreeItem(
				name,
				vscode.TreeItemCollapsibleState.None,
			)
			item.iconPath = new vscode.ThemeIcon("key")
			if (algorithm) {
				item.description = algorithm
			}
			return item
		})
	}
}

module.exports = { KeysProvider }

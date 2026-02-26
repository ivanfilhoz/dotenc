const vscode = require("vscode")
const { VIEW_DECRYPTED_COMMAND } = require("./helpers/constants")
const { getDotencExecutable } = require("./helpers/getDotencExecutable")
const { getStartupCwd } = require("./helpers/getStartupCwd")
const { getWorkspaceUriForStartup } = require("./helpers/getWorkspaceUriForStartup")
const { runProcess } = require("./helpers/runProcess")
const { stripAnsi } = require("./helpers/stripAnsi")

class EnvironmentsProvider {
	constructor() {
		this._onDidChangeTreeData = new vscode.EventEmitter()
		this.onDidChangeTreeData = this._onDidChangeTreeData.event

		this._watcher = vscode.workspace.createFileSystemWatcher("**/.env.*.enc")
		this._watcher.onDidCreate(() => this.refresh())
		this._watcher.onDidDelete(() => this.refresh())
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
		const result = await runProcess(executable, cwd, ["env", "list"])
		if (result.error || result.code !== 0) {
			return []
		}

		const names = stripAnsi(result.stdout)
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)

		return names.map((name) => {
			const fileUri = vscode.Uri.joinPath(workspaceUri, `.env.${name}.enc`)
			const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None)
			item.iconPath = new vscode.ThemeIcon("file")
			item.command = {
				command: VIEW_DECRYPTED_COMMAND,
				title: "View decrypted",
				arguments: [fileUri],
			}
			return item
		})
	}
}

module.exports = { EnvironmentsProvider }

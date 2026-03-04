const path = require("node:path")
const fs = require("node:fs")
const vscode = require("vscode")

exports.run = async () => {
	const { runProcess } = require("../../src/helpers/runProcess")

	const cliDistPath = path.resolve(__dirname, "../../../cli/dist/cli.js")

	if (!fs.existsSync(cliDistPath)) {
		vscode.window.showErrorMessage(
			"[dotenc dev] CLI is not built. Run: cd cli && bun run build",
		)
		return new Promise(() => {})
	}

	// Ensure the built CLI is executable so the OS shebang (#!/usr/bin/env node) works.
	try {
		fs.chmodSync(cliDistPath, 0o755)
	} catch (e) {
		console.error("[dotenc dev] Failed to chmod cli dist:", e.message)
	}

	// Monkeypatch: redirect every CLI spawn to the locally built dist/cli.js.
	// All callers (EnvironmentsProvider, KeysProvider, extension.js) have already
	// destructured runProcess at require-time, but runProcess() itself delegates
	// to _impl — so this change is visible to all existing references immediately.
	runProcess._setImpl((executable, cwd, args, stdinInput) =>
		runProcess._defaultImpl(cliDistPath, cwd, args, stdinInput),
	)

	// Trigger a tree refresh. EnvironmentsProvider listens for executablePath
	// changes and calls refresh() — that re-invokes runProcess with the patched impl.
	await vscode.workspace
		.getConfiguration("dotenc")
		.update("executablePath", cliDistPath, vscode.ConfigurationTarget.Global)

	// Keep VS Code open until the user closes it.
	return new Promise(() => {})
}

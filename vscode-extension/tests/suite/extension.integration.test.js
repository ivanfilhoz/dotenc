const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vscode = require("vscode")

const OPEN_NATIVE_COMMAND = "dotenc.openNative"
const OPEN_ENCRYPTED_SOURCE_COMMAND = "dotenc.openEncryptedSource"

function readJsonLines(filePath) {
	if (!fs.existsSync(filePath)) {
		return []
	}

	return fs
		.readFileSync(filePath, "utf-8")
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line))
}

function writeFakeDotencCli(filePath) {
	const script = `#!/usr/bin/env node
const fs = require("node:fs")
const path = require("node:path")

const args = process.argv.slice(2)
const cwd = process.cwd()
const logPath = path.join(cwd, ".dotenc-test-log.jsonl")
const encryptOutputPath = path.join(cwd, ".dotenc-last-encrypt.txt")

function appendLog(entry) {
	fs.appendFileSync(logPath, JSON.stringify(entry) + "\\n", "utf-8")
}

if (args.length === 1 && args[0] === "--version") {
	console.log("dotenc version 0.5.2")
	process.exit(0)
}

if (args[0] === "env" && args[1] === "decrypt") {
	const environment = args[2]
	appendLog({ command: "decrypt", environment, args })

	if (environment === "locked") {
		console.log(
			JSON.stringify({
				ok: false,
				error: {
					code: "ACCESS_DENIED",
					message: "Access denied to the environment.",
				},
			}),
		)
		process.exit(1)
	}

	const grantedUsers = environment === "allowed" ? ["alice", "bob"] : ["ops"]
	console.log(
		JSON.stringify({
			ok: true,
			content: \`ALLOWED_\${environment.toUpperCase()}=1\`,
			grantedUsers,
		}),
	)
	process.exit(0)
}

if (args[0] === "env" && args[1] === "encrypt") {
	const environment = args[2]
	let input = ""

	process.stdin.setEncoding("utf-8")
	process.stdin.on("data", (chunk) => {
		input += chunk
	})

	process.stdin.on("end", () => {
		appendLog({ command: "encrypt", environment, args, content: input })
		fs.writeFileSync(encryptOutputPath, input, "utf-8")
		console.log(JSON.stringify({ ok: true }))
	})

	process.stdin.on("error", (error) => {
		console.error(String(error))
		process.exit(1)
	})

	return
}

appendLog({ command: "unknown", args })
console.error("Unknown command: " + args.join(" "))
process.exit(1)
`

	fs.writeFileSync(filePath, script, { encoding: "utf-8", mode: 0o755 })
}

async function waitFor(predicate, timeoutMs = 8000, intervalMs = 100) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		const value = await predicate()
		if (value) {
			return value
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs))
	}

	throw new Error(`Timed out after ${timeoutMs}ms waiting for condition.`)
}

function getFullDocumentRange(document) {
	return new vscode.Range(
		document.positionAt(0),
		document.positionAt(document.getText().length),
	)
}

function hasOpenFileTab(uri) {
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			const input = tab.input
			if (!input || typeof input !== "object") {
				continue
			}
			if (!(input.uri instanceof vscode.Uri)) {
				continue
			}
			if (input.uri.toString() === uri.toString()) {
				return true
			}
		}
	}

	return false
}

suite("dotenc VS Code integration", () => {
	let workspaceRoot
	let fakeCliPath
	let logPath
	let encryptOutputPath

	suiteSetup(async () => {
		workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		assert.ok(workspaceRoot, "Workspace root should be available in tests")

		fakeCliPath = path.join(workspaceRoot, "fake-dotenc-cli.js")
		logPath = path.join(workspaceRoot, ".dotenc-test-log.jsonl")
		encryptOutputPath = path.join(workspaceRoot, ".dotenc-last-encrypt.txt")

		writeFakeDotencCli(fakeCliPath)

		await vscode.workspace
			.getConfiguration("dotenc")
			.update(
				"executablePath",
				fakeCliPath,
				vscode.ConfigurationTarget.Workspace,
			)
	})

	suiteTeardown(async () => {
		await vscode.workspace
			.getConfiguration("dotenc")
			.update("executablePath", undefined, vscode.ConfigurationTarget.Workspace)

		await vscode.commands.executeCommand("workbench.action.closeAllEditors")
	})

	setup(async () => {
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")
		if (fs.existsSync(logPath)) {
			fs.rmSync(logPath, { force: true })
		}
		if (fs.existsSync(encryptOutputPath)) {
			fs.rmSync(encryptOutputPath, { force: true })
		}
	})

	test("auto-opens authorized environments in native decrypted editor", async () => {
		const fileUri = vscode.Uri.file(path.join(workspaceRoot, ".env.allowed.enc"))
		const dotencUri = fileUri.with({ scheme: "dotenc" })

		const fileDocument = await vscode.workspace.openTextDocument(fileUri)
		await vscode.window.showTextDocument(fileDocument)

		const document = await waitFor(async () =>
			vscode.workspace.textDocuments.find(
				(current) => current.uri.toString() === dotencUri.toString(),
			),
		)

		const initialText = document.getText()
		assert.match(
			initialText,
			/^# dotenc-meta:start granted-users \(ignored on save\)\n/,
		)
		assert.match(initialText, /^# environment: allowed$/m)
		assert.match(initialText, /^# - alice$/m)
		assert.match(initialText, /^# - bob$/m)
		assert.match(initialText, /\n\nALLOWED_ALLOWED=1$/)
		assert.equal(document.languageId, "dotenv")
		assert.equal(
			vscode.window.activeTextEditor?.document.uri.toString(),
			dotencUri.toString(),
		)
		assert.equal(hasOpenFileTab(fileUri), false)

		const editor = await vscode.window.showTextDocument(document)
		const nextText = initialText.replace("ALLOWED_ALLOWED=1", "API_KEY=rotated")
		assert.notEqual(nextText, initialText)
		const applied = await editor.edit((editBuilder) => {
			editBuilder.replace(getFullDocumentRange(document), nextText)
		})
		assert.equal(applied, true)

		const saved = await document.save()
		assert.equal(saved, true)

		assert.ok(
			fs.existsSync(encryptOutputPath),
			"Encrypt output side-effect file should be created",
		)
		const writtenContent = fs.readFileSync(encryptOutputPath, "utf-8")
		assert.equal(writtenContent, "API_KEY=rotated")

		const logs = readJsonLines(logPath)
		assert.ok(
			logs.some(
				(entry) => entry.command === "decrypt" && entry.environment === "allowed",
			),
		)
		assert.ok(
			logs.some(
				(entry) => entry.command === "encrypt" && entry.environment === "allowed",
			),
		)

		await vscode.commands.executeCommand(OPEN_ENCRYPTED_SOURCE_COMMAND, dotencUri)
		await waitFor(async () =>
			vscode.window.activeTextEditor?.document.uri.toString() === fileUri.toString()
				? true
				: undefined,
		)
		assert.equal(
			vscode.window.activeTextEditor?.document.uri.toString(),
			fileUri.toString(),
		)
	})

	test("blocks opening unauthorized environments", async () => {
		const fileUri = vscode.Uri.file(path.join(workspaceRoot, ".env.locked.enc"))

		await assert.rejects(
			() => vscode.commands.executeCommand(OPEN_NATIVE_COMMAND, fileUri),
			/You do not have access to "locked"/,
		)

		const logs = readJsonLines(logPath)
		assert.ok(
			logs.some(
				(entry) => entry.command === "decrypt" && entry.environment === "locked",
			),
		)
		assert.equal(
			logs.some(
				(entry) => entry.command === "encrypt" && entry.environment === "locked",
			),
			false,
		)
	})
})

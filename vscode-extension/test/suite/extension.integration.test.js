const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vscode = require("vscode")

const GET_DOCUMENT_STATE_COMMAND = "dotenc.__test.getDocumentState"
const SET_DOCUMENT_CONTENT_COMMAND = "dotenc.__test.setDocumentContent"
const SAVE_DOCUMENT_COMMAND = "dotenc.__test.saveDocument"

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
	console.log("dotenc version 0.4.6")
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

	console.log(
		JSON.stringify({ ok: true, content: \`ALLOWED_\${environment.toUpperCase()}=1\` }),
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

async function waitForDocumentState(uriString, predicate) {
	return waitFor(async () => {
		const state = await vscode.commands.executeCommand(
			GET_DOCUMENT_STATE_COMMAND,
			uriString,
		)
		if (!state) {
			return undefined
		}
		if (predicate(state)) {
			return state
		}
		return undefined
	})
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

	test("opens and saves an authorized environment", async () => {
		const uri = vscode.Uri.file(path.join(workspaceRoot, ".env.allowed.enc"))

		await vscode.commands.executeCommand("vscode.openWith", uri, "dotenc.envEditor")

		const state = await waitForDocumentState(
			uri.toString(),
			(current) => current.canEdit === true,
		)
		assert.equal(state.content, "ALLOWED_ALLOWED=1")

		await vscode.commands.executeCommand(
			SET_DOCUMENT_CONTENT_COMMAND,
			uri.toString(),
			"API_KEY=rotated",
		)
		await vscode.commands.executeCommand(SAVE_DOCUMENT_COMMAND, uri.toString())

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
	})

	test("blocks save for unauthorized environments", async () => {
		const uri = vscode.Uri.file(path.join(workspaceRoot, ".env.locked.enc"))

		await vscode.commands.executeCommand("vscode.openWith", uri, "dotenc.envEditor")

		const state = await waitForDocumentState(
			uri.toString(),
			(current) => current.canEdit === false,
		)
		assert.equal(state.failure?.code, "ACCESS_DENIED")

		await assert.rejects(
			() =>
				vscode.commands.executeCommand(SAVE_DOCUMENT_COMMAND, uri.toString()),
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

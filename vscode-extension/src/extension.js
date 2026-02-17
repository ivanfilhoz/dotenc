const path = require("node:path")
const { spawn } = require("node:child_process")
const vscode = require("vscode")
const {
	MIN_DOTENC_VERSION,
	formatDetectedVersion,
	getFailureSteps,
	getFailureUserMessage,
	isVersionSupported,
	mapFailureCode,
	parseEnvironmentName,
	parseJsonPayload,
	stripAnsi,
} = require("./core")

const VIEW_TYPE = "dotenc.envEditor"
const versionCompatibilityCache = new Map()

class DotencDocument {
	constructor(uri, environmentName, workspaceRoot) {
		this.uri = uri
		this.environmentName = environmentName
		this.workspaceRoot = workspaceRoot
		this._content = ""
		this._savedContent = ""
		this._failure = null
		this._onDidDispose = new vscode.EventEmitter()
		this.onDidDispose = this._onDidDispose.event
	}

	dispose() {
		this._onDidDispose.fire()
		this._onDidDispose.dispose()
	}

	get content() {
		return this._content
	}

	setContent(content) {
		this._content = content
	}

	reset(content) {
		this._content = content
		this._savedContent = content
	}

	markSaved() {
		this._savedContent = this._content
	}

	get isDirty() {
		return this._content !== this._savedContent
	}

	get failure() {
		return this._failure
	}

	setFailure(failure) {
		this._failure = failure
	}

	clearFailure() {
		this._failure = null
	}

	get canEdit() {
		return this._failure === null
	}
}

class DotencEditorProvider {
	constructor() {
		this._onDidChangeCustomDocument = new vscode.EventEmitter()
		this.onDidChangeCustomDocument = this._onDidChangeCustomDocument.event
		this._panels = new Map()
		this._documents = new Map()
	}

	async openCustomDocument(uri) {
		const environmentName = parseEnvironmentName(uri.fsPath)
		if (!environmentName) {
			throw new Error(
				`Invalid dotenc file name: ${path.basename(uri.fsPath)}. Expected format ".env.<environment>.enc".`,
			)
		}

		const workspaceRoot = getWorkspaceRoot(uri)
		if (!workspaceRoot) {
			throw new Error(
				"Could not determine workspace root for this file. Open the containing folder as a VS Code workspace.",
			)
		}

		const document = new DotencDocument(uri, environmentName, workspaceRoot)
		this._documents.set(uri.toString(), document)
		document.onDidDispose(() => {
			this._documents.delete(uri.toString())
		})

		const result = await decryptEnvironment(document)

		if (result.ok) {
			document.reset(result.content)
			document.clearFailure()
		} else {
			document.reset("")
			document.setFailure(result.error)
		}

		return document
	}

	async resolveCustomEditor(document, webviewPanel) {
		webviewPanel.webview.options = {
			enableScripts: true,
		}

		this._panels.set(document.uri.toString(), webviewPanel)
		webviewPanel.onDidDispose(() => {
			this._panels.delete(document.uri.toString())
		})

		webviewPanel.webview.onDidReceiveMessage((message) => {
			if (!message || message.type !== "edit") {
				return
			}

			if (!document.canEdit) {
				return
			}

			const nextContent =
				typeof message.content === "string" ? message.content : ""
			if (nextContent === document.content) {
				return
			}

			const previousContent = document.content
			document.setContent(nextContent)

			this._onDidChangeCustomDocument.fire({
				document,
				label: "Edit dotenc environment",
				undo: async () => {
					document.setContent(previousContent)
					this.postContentToEditor(document)
				},
				redo: async () => {
					document.setContent(nextContent)
					this.postContentToEditor(document)
				},
			})
		})

		this.renderDocument(document)
	}

	async saveCustomDocument(document) {
		if (!document.canEdit) {
			throw new Error(
				getFailureUserMessage(document.environmentName, document.failure),
			)
		}

		const result = await encryptEnvironment(document, document.content)

		if (!result.ok) {
			document.setFailure(result.error)
			this.renderDocument(document)
			throw new Error(
				getFailureUserMessage(document.environmentName, result.error),
			)
		}

		document.markSaved()
	}

	async saveCustomDocumentAs(document, destination) {
		await this.saveCustomDocument(document)
		await vscode.workspace.fs.copy(document.uri, destination, {
			overwrite: true,
		})
	}

	async revertCustomDocument(document) {
		const result = await decryptEnvironment(document)

		if (result.ok) {
			document.reset(result.content)
			document.clearFailure()
		} else {
			document.reset("")
			document.setFailure(result.error)
		}

		this.renderDocument(document)
	}

	async backupCustomDocument(document, context) {
		await vscode.workspace.fs.copy(document.uri, context.destination, {
			overwrite: true,
		})

		return {
			id: context.destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(context.destination)
				} catch {
					// no-op
				}
			},
		}
	}

	renderDocument(document) {
		const panel = this._panels.get(document.uri.toString())
		if (!panel) {
			return
		}

		if (!document.canEdit) {
			panel.webview.html = getFailureHtml(
				panel.webview,
				document.environmentName,
				document.failure,
			)
			return
		}

		panel.webview.html = getEditorHtml(
			panel.webview,
			document.environmentName,
			document.content,
		)
	}

	postContentToEditor(document) {
		const panel = this._panels.get(document.uri.toString())
		if (!panel) {
			return
		}

		panel.webview.postMessage({ type: "setContent", content: document.content })
	}

	getDocumentForTesting(uriString) {
		return this._documents.get(uriString)
	}

	getDocumentStateForTesting(uriString) {
		const document = this.getDocumentForTesting(uriString)
		if (!document) {
			return undefined
		}

		return {
			environmentName: document.environmentName,
			content: document.content,
			isDirty: document.isDirty,
			canEdit: document.canEdit,
			failure: document.failure,
		}
	}

	setDocumentContentForTesting(uriString, content) {
		const document = this.getDocumentForTesting(uriString)
		if (!document) {
			throw new Error(`Document not found: ${uriString}`)
		}

		if (!document.canEdit) {
			throw new Error(
				getFailureUserMessage(document.environmentName, document.failure),
			)
		}

		document.setContent(content)
		this.renderDocument(document)
	}

	async saveDocumentForTesting(uriString) {
		const document = this.getDocumentForTesting(uriString)
		if (!document) {
			throw new Error(`Document not found: ${uriString}`)
		}

		await this.saveCustomDocument(document)
	}
}

function getWorkspaceRoot(uri) {
	const folder = vscode.workspace.getWorkspaceFolder(uri)
	return folder?.uri.fsPath
}

function getDotencExecutable(uri) {
	return vscode.workspace
		.getConfiguration("dotenc", uri)
		.get("executablePath", "dotenc")
}

async function runProcess(executable, cwd, args, stdinInput) {
	return new Promise((resolve) => {
		let stdout = ""
		let stderr = ""
		let settled = false

		const child = spawn(executable, args, {
			cwd,
			env: process.env,
			shell: process.platform === "win32",
		})

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString()
		})

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString()
		})

		child.on("error", (error) => {
			if (settled) {
				return
			}
			settled = true
			resolve({ code: 1, stdout, stderr, error })
		})

		child.on("close", (code) => {
			if (settled) {
				return
			}
			settled = true
			resolve({ code: code ?? 1, stdout, stderr, error: undefined })
		})

		if (typeof stdinInput === "string") {
			child.stdin.write(stdinInput)
			child.stdin.end()
		}
	})
}

async function ensureDotencCompatibility(uri, cwd) {
	const executable = getDotencExecutable(uri)
	const cacheKey = `${cwd}::${executable}`
	const cached = versionCompatibilityCache.get(cacheKey)
	if (cached) {
		return cached
	}

	const versionResult = await runProcess(executable, cwd, ["--version"])

	if (versionResult.error && versionResult.error.code === "ENOENT") {
		const failure = fallbackFailure(versionResult)
		return { ok: false, error: failure }
	}

	if (versionResult.code !== 0) {
		const failure = fallbackFailure(versionResult)
		return { ok: false, error: failure }
	}

	const versionOutput = stripAnsi(
		`${versionResult.stdout}\n${versionResult.stderr}`.trim(),
	)
	if (!isVersionSupported(versionOutput, MIN_DOTENC_VERSION)) {
		const detectedVersion = formatDetectedVersion(versionOutput)
		return {
			ok: false,
			error: {
				code: "CLI_VERSION_UNSUPPORTED",
				message: `dotenc CLI version ${detectedVersion} is not supported. This extension requires dotenc >= ${MIN_DOTENC_VERSION}.`,
			},
		}
	}

	const compatibility = { ok: true }
	versionCompatibilityCache.set(cacheKey, compatibility)
	return compatibility
}

async function runDotenc(uri, cwd, args, stdinInput) {
	const compatibility = await ensureDotencCompatibility(uri, cwd)
	if (!compatibility.ok) {
		return {
			code: 1,
			stdout: "",
			stderr: compatibility.error.message,
			error: undefined,
		}
	}

	return runProcess(getDotencExecutable(uri), cwd, args, stdinInput)
}

function fallbackFailure(result) {
	if (result.error && result.error.code === "ENOENT") {
		return {
			code: "CLI_NOT_FOUND",
			message:
				'dotenc CLI was not found. Configure "dotenc.executablePath" in VS Code settings or install dotenc.',
		}
	}

	const message = stripAnsi(
		result.stderr.trim() ||
			result.stdout.trim() ||
			"Unknown error occurred while running dotenc.",
	)

	return {
		code: mapFailureCode(message),
		message,
	}
}

async function decryptEnvironment(document) {
	const result = await runDotenc(
		document.uri,
		document.workspaceRoot,
		["env", "decrypt", document.environmentName, "--json"],
		undefined,
	)

	const parsed = parseJsonPayload(result.stdout)
	if (parsed && parsed.ok === true && typeof parsed.content === "string") {
		return { ok: true, content: parsed.content }
	}

	if (parsed && parsed.ok === false && parsed.error) {
		return {
			ok: false,
			error: {
				code: parsed.error.code || "UNKNOWN",
				message: stripAnsi(
					parsed.error.message || "Failed to decrypt environment.",
				),
			},
		}
	}

	return { ok: false, error: fallbackFailure(result) }
}

async function encryptEnvironment(document, plaintext) {
	const result = await runDotenc(
		document.uri,
		document.workspaceRoot,
		["env", "encrypt", document.environmentName, "--stdin", "--json"],
		plaintext,
	)

	const parsed = parseJsonPayload(result.stdout)
	if (parsed && parsed.ok === true) {
		return { ok: true }
	}

	if (parsed && parsed.ok === false && parsed.error) {
		return {
			ok: false,
			error: {
				code: parsed.error.code || "UNKNOWN",
				message: stripAnsi(
					parsed.error.message || "Failed to encrypt environment.",
				),
			},
		}
	}

	return { ok: false, error: fallbackFailure(result) }
}

function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
}

function getFailureHtml(_webview, environmentName, failure) {
	const nonce = String(Date.now())
	const message = failure
		? escapeHtml(failure.message)
		: "Unknown error while opening this file."

	const title =
		failure?.code === "ACCESS_DENIED"
			? `You do not have access to "${escapeHtml(environmentName)}". Please ask your teammates.`
			: `Could not open "${escapeHtml(environmentName)}"`

	const steps = getFailureSteps(environmentName, failure)
		.map((step) => `<li>${escapeHtml(step)}</li>`)
		.join("")

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dotenc access message</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 24px;
    }
    .box {
      max-width: 820px;
      border: 1px solid var(--vscode-editorWidget-border);
      background: var(--vscode-editorWidget-background);
      padding: 20px;
      border-radius: 8px;
    }
    h2 {
      margin-top: 0;
      font-size: 18px;
    }
    p {
      line-height: 1.5;
    }
    li {
      margin: 10px 0;
      line-height: 1.5;
      white-space: pre-wrap;
      font-family: var(--vscode-editor-font-family);
    }
    .note {
      margin-top: 18px;
      opacity: 0.9;
    }
    a {
      color: var(--vscode-textLink-foreground);
    }
  </style>
</head>
<body>
  <div class="box" data-nonce="${nonce}">
    <h2>${title}</h2>
    <p>${message}</p>
    <ol>${steps}</ol>
    <p class="note">For full team onboarding instructions, see the <a href="https://github.com/ivanfilhoz/dotenc#team-collaboration">Team Collaboration section in the dotenc README</a>.</p>
  </div>
</body>
</html>`
}

function getEditorHtml(_webview, environmentName, content) {
	const nonce = String(Date.now())
	const serializedContent = JSON.stringify(content).replace(/</g, "\\u003c")
	const escapedEnvironmentName = escapeHtml(environmentName)

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dotenc editor</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-editor-font-family);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      border-bottom: 1px solid var(--vscode-editorWidget-border);
      padding: 8px 12px;
      font-size: 12px;
      opacity: 0.9;
    }
    #editor {
      flex: 1;
      width: 100%;
      border: none;
      outline: none;
      resize: none;
      padding: 12px;
      box-sizing: border-box;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.5;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }
  </style>
</head>
<body>
  <div class="header">Editing encrypted environment: <strong>${escapedEnvironmentName}</strong></div>
  <textarea id="editor" spellcheck="false"></textarea>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById("editor");
    editor.value = ${serializedContent};

    editor.addEventListener("input", () => {
      vscode.postMessage({ type: "edit", content: editor.value });
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || message.type !== "setContent" || typeof message.content !== "string") {
        return;
      }

      if (message.content === editor.value) {
        return;
      }

      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = message.content;
      editor.setSelectionRange(start, end);
    });
  </script>
</body>
</html>`
}

function activate(context) {
	const provider = new DotencEditorProvider()
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
			supportsMultipleEditorsPerDocument: false,
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		}),
	)

	if (process.env.DOTENC_VSCODE_TEST === "1") {
		context.subscriptions.push(
			vscode.commands.registerCommand(
				"dotenc.__test.getDocumentState",
				(uriString) => provider.getDocumentStateForTesting(uriString),
			),
			vscode.commands.registerCommand(
				"dotenc.__test.setDocumentContent",
				(uriString, content) =>
					provider.setDocumentContentForTesting(uriString, content),
			),
			vscode.commands.registerCommand(
				"dotenc.__test.saveDocument",
				(uriString) => provider.saveDocumentForTesting(uriString),
			),
		)
	}
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}

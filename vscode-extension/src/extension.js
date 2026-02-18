const vscode = require("vscode")
const { addGrantedUsersHeader } = require("./helpers/addGrantedUsersHeader")
const { appendProcessLogs } = require("./helpers/appendProcessLogs")
const { closeFileTabs } = require("./helpers/closeFileTabs")
const {
	DOTENC_SCHEME,
	INSTALL_ACTION_LABEL,
	OPEN_ENCRYPTED_SOURCE_COMMAND,
	OPEN_NATIVE_COMMAND,
	SHOW_LOGS_ACTION_LABEL,
	UPDATE_ACTION_LABEL,
} = require("./helpers/constants")
const {
	ensureEnvironmentLanguage,
} = require("./helpers/ensureEnvironmentLanguage")
const { fallbackFailure } = require("./helpers/fallbackFailure")
const { fetchLatestCliVersion } = require("./helpers/fetchLatestCliVersion")
const { formatDetectedVersion } = require("./helpers/formatDetectedVersion")
const { getDotencExecutable } = require("./helpers/getDotencExecutable")
const { getDotencInstallCommand } = require("./helpers/getDotencInstallCommand")
const { getDotencTarget } = require("./helpers/getDotencTarget")
const { getStartupCwd } = require("./helpers/getStartupCwd")
const {
	getWorkspaceUriForStartup,
} = require("./helpers/getWorkspaceUriForStartup")
const { isAutoOpenNativeEnabled } = require("./helpers/isAutoOpenNativeEnabled")
const {
	isDotencEnvironmentFileUri,
} = require("./helpers/isDotencEnvironmentFileUri")
const { isUpdateMethodFallback } = require("./helpers/isUpdateMethodFallback")
const { isVersionNewer } = require("./helpers/isVersionNewer")
const { isVersionSupported } = require("./helpers/isVersionSupported")
const {
	mapFailureToFileSystemError,
} = require("./helpers/mapFailureToFileSystemError")
const { MIN_DOTENC_VERSION } = require("./helpers/minDotencVersion")
const { normalizeCommentValue } = require("./helpers/normalizeCommentValue")
const { parseJsonPayload } = require("./helpers/parseJsonPayload")
const {
	removeGrantedUsersHeader,
} = require("./helpers/removeGrantedUsersHeader")
const { resolveSourceUri } = require("./helpers/resolveSourceUri")
const { runProcess } = require("./helpers/runProcess")
const {
	shouldShowOpenEncryptedSourceAction,
} = require("./helpers/shouldShowOpenEncryptedSourceAction")
const {
	shouldSkipCliUpdateCheck,
} = require("./helpers/shouldSkipCliUpdateCheck")
const { stripAnsi } = require("./helpers/stripAnsi")
const { toDotencUri } = require("./helpers/toDotencUri")
const { toErrorMessage } = require("./helpers/toErrorMessage")
const { toFileUri } = require("./helpers/toFileUri")

const versionCompatibilityCache = new Map()

class DotencFileSystemProvider {
	constructor() {
		this._onDidChangeFile = new vscode.EventEmitter()
		this.onDidChangeFile = this._onDidChangeFile.event
	}

	watch() {
		return new vscode.Disposable(() => {})
	}

	async stat(uri) {
		return vscode.workspace.fs.stat(toFileUri(uri))
	}

	async readDirectory(uri) {
		return vscode.workspace.fs.readDirectory(toFileUri(uri))
	}

	async createDirectory(uri) {
		await vscode.workspace.fs.createDirectory(toFileUri(uri))
	}

	async readFile(uri) {
		const target = getDotencTarget(uri)
		const result = await decryptEnvironment(target)
		if (!result.ok) {
			throw mapFailureToFileSystemError(target.environmentName, result.error)
		}

		const content = addGrantedUsersHeader(
			result.content,
			target.environmentName,
			result.grantedUsers,
		)
		return Buffer.from(content, "utf-8")
	}

	async writeFile(uri, content) {
		const target = getDotencTarget(uri)
		const plaintext = removeGrantedUsersHeader(
			Buffer.from(content).toString("utf-8"),
		)
		const result = await encryptEnvironment(target, plaintext)
		if (!result.ok) {
			throw mapFailureToFileSystemError(target.environmentName, result.error)
		}
	}

	async delete(uri, options) {
		await vscode.workspace.fs.delete(toFileUri(uri), options)
	}

	async rename(oldUri, newUri, options) {
		await vscode.workspace.fs.rename(
			toFileUri(oldUri),
			toFileUri(newUri),
			options,
		)
	}
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

async function decryptEnvironment(document) {
	const result = await runDotenc(
		document.uri,
		document.workspaceRoot,
		["env", "decrypt", document.environmentName, "--json"],
		undefined,
	)

	const parsed = parseJsonPayload(result.stdout)
	if (parsed && parsed.ok === true && typeof parsed.content === "string") {
		const grantedUsers = Array.isArray(parsed.grantedUsers)
			? parsed.grantedUsers
					.filter((value) => typeof value === "string")
					.map((value) => normalizeCommentValue(value))
					.filter((value) => value.length > 0)
			: []

		return { ok: true, content: parsed.content, grantedUsers }
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

async function runCliUpdate(
	workspaceUri,
	outputChannel,
	currentVersion,
	latestVersion,
) {
	const executable = getDotencExecutable(workspaceUri)
	const cwd = getStartupCwd(workspaceUri)
	const updateResult = await runProcess(executable, cwd, ["update"])
	const output = stripAnsi(
		`${updateResult.stdout}\n${updateResult.stderr}`.trim(),
	)

	appendProcessLogs(
		outputChannel,
		`[dotenc] ${executable} update (current: ${currentVersion}, latest: ${latestVersion})`,
		updateResult,
	)

	if (isUpdateMethodFallback(output)) {
		const action = await vscode.window.showWarningMessage(
			"dotenc could not self-update automatically for this installation method. Check logs for manual update instructions.",
			SHOW_LOGS_ACTION_LABEL,
		)
		if (action === SHOW_LOGS_ACTION_LABEL) {
			outputChannel.show(true)
		}
		return
	}

	if (updateResult.error && updateResult.error.code === "ENOENT") {
		vscode.window.showErrorMessage(
			'dotenc CLI was not found. Configure "dotenc.executablePath" in VS Code settings.',
		)
		return
	}

	if (updateResult.code !== 0) {
		const action = await vscode.window.showErrorMessage(
			"dotenc update failed. Check logs for details.",
			SHOW_LOGS_ACTION_LABEL,
		)
		if (action === SHOW_LOGS_ACTION_LABEL) {
			outputChannel.show(true)
		}
		return
	}

	vscode.window.showInformationMessage(
		`dotenc update completed (${currentVersion} -> ${latestVersion}). Restart terminal sessions if needed.`,
	)
}

async function maybePromptCliInstall(
	_workspaceUri,
	outputChannel,
	executable,
	cwd,
) {
	if (executable !== "dotenc") {
		return false
	}

	const action = await vscode.window.showInformationMessage(
		"dotenc CLI was not found on PATH. Install it now using the official installer?",
		INSTALL_ACTION_LABEL,
	)
	if (action !== INSTALL_ACTION_LABEL) {
		return false
	}

	const installCommand = getDotencInstallCommand()
	if (!installCommand) {
		vscode.window.showWarningMessage(
			'Automatic installation via curl is currently unavailable on this platform. Install dotenc manually or configure "dotenc.executablePath".',
		)
		return false
	}

	const installResult = await runProcess(
		installCommand.executable,
		cwd,
		installCommand.args,
	)
	appendProcessLogs(
		outputChannel,
		`[dotenc] ${installCommand.executable} ${installCommand.args.join(" ")}`,
		installResult,
	)

	if (installResult.error || installResult.code !== 0) {
		const logsAction = await vscode.window.showErrorMessage(
			"dotenc installation failed. Check logs for details.",
			SHOW_LOGS_ACTION_LABEL,
		)
		if (logsAction === SHOW_LOGS_ACTION_LABEL) {
			outputChannel.show(true)
		}
		return false
	}

	const postInstallVersion = await runProcess(executable, cwd, ["--version"])
	appendProcessLogs(
		outputChannel,
		`[dotenc] ${executable} --version (after install)`,
		postInstallVersion,
	)

	if (postInstallVersion.error || postInstallVersion.code !== 0) {
		const logsAction = await vscode.window.showWarningMessage(
			"dotenc was installed, but it is not yet available in this VS Code session. Restart VS Code or set dotenc.executablePath manually.",
			SHOW_LOGS_ACTION_LABEL,
		)
		if (logsAction === SHOW_LOGS_ACTION_LABEL) {
			outputChannel.show(true)
		}
		return false
	}

	versionCompatibilityCache.clear()
	vscode.window.showInformationMessage("dotenc CLI installed successfully.")
	return true
}

async function maybePromptCliUpdate(outputChannel) {
	if (shouldSkipCliUpdateCheck()) {
		return
	}

	const workspaceUri = getWorkspaceUriForStartup()
	const executable = getDotencExecutable(workspaceUri)
	const cwd = getStartupCwd(workspaceUri)
	let versionResult = await runProcess(executable, cwd, ["--version"])

	if (versionResult.error && versionResult.error.code === "ENOENT") {
		const installed = await maybePromptCliInstall(
			workspaceUri,
			outputChannel,
			executable,
			cwd,
		)
		if (!installed) {
			return
		}

		versionResult = await runProcess(executable, cwd, ["--version"])
	}

	if (versionResult.error || versionResult.code !== 0) {
		return
	}

	const currentVersion = formatDetectedVersion(
		stripAnsi(`${versionResult.stdout}\n${versionResult.stderr}`.trim()),
	)
	if (currentVersion === "unknown") {
		return
	}

	const latestVersion = await fetchLatestCliVersion()
	if (!latestVersion || !isVersionNewer(latestVersion, currentVersion)) {
		return
	}

	const action = await vscode.window.showInformationMessage(
		`A newer dotenc CLI version is available (${currentVersion} -> ${latestVersion}).`,
		UPDATE_ACTION_LABEL,
	)

	if (action !== UPDATE_ACTION_LABEL) {
		return
	}

	await runCliUpdate(workspaceUri, outputChannel, currentVersion, latestVersion)
}

async function openNativeEnvironment(resource) {
	const fileUri = resolveSourceUri(resource)
	const dotencUri = toDotencUri(fileUri)

	try {
		let document = await vscode.workspace.openTextDocument(dotencUri)
		document = await ensureEnvironmentLanguage(document)
		await vscode.window.showTextDocument(document)
		await closeFileTabs(fileUri)
	} catch (error) {
		const message = toErrorMessage(error)
		vscode.window.showErrorMessage(message)
		throw new Error(message)
	}
}

async function openEncryptedSource(resource, suppressAutoRedirectOnce) {
	const fileUri = resolveSourceUri(resource)
	const key = fileUri.toString()
	suppressAutoRedirectOnce.add(key)

	try {
		const document = await vscode.workspace.openTextDocument(fileUri)
		await vscode.window.showTextDocument(document)
	} catch (error) {
		suppressAutoRedirectOnce.delete(key)
		const message = toErrorMessage(error)
		vscode.window.showErrorMessage(message)
		throw new Error(message)
	}
}

function activate(context) {
	const fileSystemProvider = new DotencFileSystemProvider()
	const outputChannel = vscode.window.createOutputChannel("dotenc")
	const redirectInProgress = new Set()
	const suppressAutoRedirectOnce = new Set()
	const openEncryptedSourceStatus = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		90,
	)
	openEncryptedSourceStatus.name = "dotenc open encrypted source"
	openEncryptedSourceStatus.text = "$(file-code) Open Encrypted Source"
	openEncryptedSourceStatus.tooltip =
		"Open the raw .env.<environment>.enc file for troubleshooting."
	openEncryptedSourceStatus.command = OPEN_ENCRYPTED_SOURCE_COMMAND

	const autoOpenCurrentEditorIfNeeded = async (editor) => {
		if (!editor || !editor.document) {
			return
		}

		const uri = editor.document.uri
		if (!isDotencEnvironmentFileUri(uri)) {
			return
		}
		if (!isAutoOpenNativeEnabled()) {
			return
		}

		const key = uri.toString()
		if (suppressAutoRedirectOnce.has(key)) {
			suppressAutoRedirectOnce.delete(key)
			return
		}
		if (redirectInProgress.has(key)) {
			return
		}
		redirectInProgress.add(key)

		try {
			await openNativeEnvironment(uri)
		} catch {
			// Error already surfaced via showErrorMessage in openNativeEnvironment.
		} finally {
			redirectInProgress.delete(key)
		}
	}

	const updateOpenEncryptedSourceStatus = (editor) => {
		if (!shouldShowOpenEncryptedSourceAction(editor)) {
			openEncryptedSourceStatus.hide()
			return
		}
		openEncryptedSourceStatus.show()
	}

	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(
			DOTENC_SCHEME,
			fileSystemProvider,
			{
				isCaseSensitive: process.platform !== "win32",
			},
		),
		vscode.commands.registerCommand(OPEN_NATIVE_COMMAND, openNativeEnvironment),
		vscode.commands.registerCommand(OPEN_ENCRYPTED_SOURCE_COMMAND, (resource) =>
			openEncryptedSource(resource, suppressAutoRedirectOnce),
		),
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			void autoOpenCurrentEditorIfNeeded(editor)
			updateOpenEncryptedSourceStatus(editor)
		}),
		outputChannel,
		openEncryptedSourceStatus,
	)

	void autoOpenCurrentEditorIfNeeded(vscode.window.activeTextEditor)
	void maybePromptCliUpdate(outputChannel).catch((error) => {
		outputChannel.appendLine(
			`Failed to check for CLI updates: ${error instanceof Error ? error.message : String(error)}`,
		)
	})
	updateOpenEncryptedSourceStatus(vscode.window.activeTextEditor)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}

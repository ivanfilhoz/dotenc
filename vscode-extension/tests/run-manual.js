const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { runTests } = require("@vscode/test-electron")

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

	console.log(
		JSON.stringify({
			ok: true,
			content: \`# decrypted: \${environment}\\nAPI_KEY=mock-api-key\\nDB_URL=mock-db-url\\nSESSION_SECRET=mock-session-secret\\n\`,
			grantedUsers: ["alice", "bob"],
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

async function main() {
	const extensionDevelopmentPath = path.resolve(__dirname, "..")
	const extensionTestsPath = path.resolve(__dirname, "suite", "manual-setup.js")
	const fixtureWorkspacePath = path.resolve(__dirname, "fixtures", "workspace")

	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dotenc-vscode-manual-"))
	const workspacePath = path.join(tmpRoot, "workspace")
	fs.cpSync(fixtureWorkspacePath, workspacePath, { recursive: true })

	const fakeCliPath = path.join(workspacePath, "fake-dotenc-cli.js")
	writeFakeDotencCli(fakeCliPath)

	fs.mkdirSync(path.join(workspacePath, ".vscode"), { recursive: true })
	fs.writeFileSync(
		path.join(workspacePath, ".vscode", "settings.json"),
		JSON.stringify({ "dotenc.executablePath": fakeCliPath }, null, "\t"),
		"utf-8",
	)

	console.log(`Workspace: ${workspacePath}`)
	console.log("Opening VS Code... close the window when done.\n")

	try {
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [workspacePath, "--disable-extensions"],
			extensionTestsEnv: {
				DOTENC_VSCODE_TEST: "1",
			},
		})
	} catch {
		// VS Code closed by the user — expected
	} finally {
		fs.rmSync(tmpRoot, { recursive: true, force: true })
		console.log("\nCleaned up.")
	}
}

main().catch((error) => {
	console.error("Failed to launch manual test environment.")
	console.error(error)
	process.exit(1)
})

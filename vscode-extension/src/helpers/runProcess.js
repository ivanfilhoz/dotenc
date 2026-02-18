const { spawn } = require("node:child_process")

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

module.exports = {
	runProcess,
}

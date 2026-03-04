const { spawn } = require("node:child_process")

async function _defaultImpl(executable, cwd, args, stdinInput) {
	return new Promise((resolve) => {
		let stdout = ""
		let stderr = ""
		let settled = false

		const normalizedExecutable =
			typeof executable === "string" ? executable.trim() : ""
		if (!normalizedExecutable) {
			resolve({
				code: 1,
				stdout,
				stderr,
				error: new Error("dotenc executable path is empty."),
			})
			return
		}

		const child = spawn(normalizedExecutable, args, {
			cwd,
			env: process.env,
			shell: false,
			windowsHide: true,
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

let _impl = _defaultImpl

/**
 * Spawn the dotenc CLI and collect stdout/stderr.
 *
 * The implementation is swappable via _setImpl so the dev/test harness can
 * redirect all CLI calls to a different executable without touching the callers
 * (which all destructure this export at require-time).
 */
async function runProcess(executable, cwd, args, stdinInput) {
	return _impl(executable, cwd, args, stdinInput)
}

/** Replace the spawn implementation. Called by the dev/test harness. */
runProcess._setImpl = (fn) => {
	_impl = fn
}

/** Restore the default spawn implementation. */
runProcess._clearImpl = () => {
	_impl = _defaultImpl
}

/** The original spawn implementation, available to overrides that want to delegate. */
runProcess._defaultImpl = _defaultImpl

module.exports = {
	runProcess,
}

#!/usr/bin/env node
const entries = Object.entries(process.env)
	.filter(([key]) => !key.startsWith("_") && !["PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "PWD", "OLDPWD", "LOGNAME", "TMPDIR", "XDG_SESSION_TYPE"].includes(key))
	.sort(([a], [b]) => a.localeCompare(b))

if (entries.length === 0) {
	console.log("(no env vars)")
} else {
	for (const [key, value] of entries) {
		console.log(`${key}=${value}`)
	}
}

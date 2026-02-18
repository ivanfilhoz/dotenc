function appendProcessLogs(channel, title, result) {
	channel.appendLine(title)
	if (result.stdout.trim().length > 0) {
		channel.appendLine(result.stdout.trimEnd())
	}
	if (result.stderr.trim().length > 0) {
		channel.appendLine(result.stderr.trimEnd())
	}
	if (result.error) {
		channel.appendLine(
			`Process error: ${result.error instanceof Error ? result.error.message : String(result.error)}`,
		)
	}
}

module.exports = {
	appendProcessLogs,
}

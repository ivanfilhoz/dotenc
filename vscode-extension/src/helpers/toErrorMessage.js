function toErrorMessage(error) {
	if (!error) {
		return "Unknown error while opening this file."
	}

	if (typeof error === "string") {
		return error
	}

	if (error instanceof Error && typeof error.message === "string") {
		return error.message.replace(/^.+FileSystemError:\s*/u, "")
	}

	return String(error)
}

module.exports = {
	toErrorMessage,
}

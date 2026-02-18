function normalizeCommentValue(value) {
	return String(value)
		.replace(/[\r\n]+/g, " ")
		.trim()
}

module.exports = {
	normalizeCommentValue,
}

function isUpdateMethodFallback(output) {
	if (typeof output !== "string") {
		return false
	}

	return /could not determine installation method automatically|standalone binary detected|unrecognized (installation )?method/i.test(
		output,
	)
}

module.exports = {
	isUpdateMethodFallback,
}

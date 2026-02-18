function getFailureUserMessage(environmentName, failure) {
	if (!failure) {
		return "This file cannot be edited right now."
	}

	if (failure.code === "ACCESS_DENIED") {
		return [
			`You do not have access to "${environmentName}".`,
			'Run "dotenc whoami" to check your identity.',
			"Ask a teammate with access to grant you this environment.",
		].join(" ")
	}

	return failure.message
}

module.exports = {
	getFailureUserMessage,
}

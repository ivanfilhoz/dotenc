function mapFailureCode(message) {
	if (message.includes("dotenc CLI was not found")) {
		return "CLI_NOT_FOUND"
	}
	if (message.includes("Access denied to the environment.")) {
		return "ACCESS_DENIED"
	}
	if (message.includes("Environment file not found")) {
		return "ENVIRONMENT_NOT_FOUND"
	}
	if (
		message.includes("No private keys found") ||
		message.includes("No matching key found")
	) {
		return "NO_IDENTITY"
	}
	if (message.includes("No public keys found")) {
		return "NO_PUBLIC_KEYS"
	}
	if (message.toLowerCase().includes("passphrase-protected")) {
		return "PASSPHRASE_PROTECTED_KEYS"
	}
	if (message.includes("No project found")) {
		return "PROJECT_NOT_INITIALIZED"
	}
	if (message.includes("Invalid environment name")) {
		return "INVALID_ENVIRONMENT_NAME"
	}
	if (message.includes("requires dotenc >=")) {
		return "CLI_VERSION_UNSUPPORTED"
	}
	return "UNKNOWN"
}

module.exports = {
	mapFailureCode,
}

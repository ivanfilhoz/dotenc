/**
 * Parses a .env file content and returns an object of key-value pairs.
 */
export const parseEnv = (content: string) => {
	const env = {} as Record<string, string>
	const lines = content.split("\n")

	for (const line of lines) {
		const trimmedLine = line.trim()

		// Skip empty lines and comments
		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue
		}

		// Parse key-value pairs
		const [key, ...valueParts] = trimmedLine.split("=")
		const value = valueParts.join("=").trim()

		if (key) {
			env[key.trim()] = value.replace(/(^['"])|(['"]$)/g, "") // Remove surrounding quotes
		}
	}

	return env
}

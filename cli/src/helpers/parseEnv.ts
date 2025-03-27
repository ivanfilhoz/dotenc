/**
 * Parses a .env file content and returns an object of key-value pairs.
 * Supports multiline values when they are properly quoted.
 * Supports nested quotes (e.g., "value with 'quotes' inside" or 'value with "quotes" inside')
 */
export const parseEnv = (content: string) => {
	const env = {} as Record<string, string>
	let currentKey = ""
	let currentValue = ""
	let isInSingleQuotes = false
	let isInDoubleQuotes = false
	let isInComment = false
	let isInKey = true

	const commit = (trim: boolean) => {
		if (currentKey.trim()) {
			env[currentKey.trim()] = trim ? currentValue.trim() : currentValue
		}
		currentKey = ""
		currentValue = ""
		isInSingleQuotes = false
		isInDoubleQuotes = false
		isInComment = false
		isInKey = true
	}

	for (const char of content) {
		// Handle single quoted content
		if (isInSingleQuotes) {
			if (char === "'") {
				commit(false)
			} else {
				currentValue += char
			}
			continue
		}

		// Handle double quoted content
		if (isInDoubleQuotes) {
			if (char === '"') {
				commit(false)
			} else {
				currentValue += char
			}
			continue
		}

		// Handle comments
		if (isInComment) {
			if (char === "\n") {
				isInComment = false
			}
			continue
		}

		if (char === "#") {
			isInComment = true
			continue
		}

		// Handle keys
		if (isInKey) {
			if (char === "=") {
				isInKey = false
			} else {
				currentKey += char
			}
			continue
		}

		// Handle newlines
		if (char === "\n") {
			commit(true)
		}

		// Handle single quote opening
		if (char === "'") {
			currentValue = ""
			isInSingleQuotes = true
			continue
		}

		// Handle double quote opening
		if (char === '"') {
			currentValue = ""
			isInDoubleQuotes = true
			continue
		}

		// Handle value
		currentValue += char
	}

	// Handle EOF
	commit(true)

	return env
}

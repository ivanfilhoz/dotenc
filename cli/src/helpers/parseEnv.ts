/**
 * Parses a .env file content and returns an object of key-value pairs.
 * Credits to dotenv: https://github.com/motdotla/dotenv/blob/master/lib/main.js
 */

const LINE =
	/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm

// Parse src into an Object
export const parseEnv = (lines: string) => {
	const obj: Record<string, string> = {}

	// Convert line breaks to same format
	lines = lines.replace(/\r\n?/gm, "\n")

	let match: RegExpExecArray | null
	// biome-ignore lint/suspicious/noAssignInExpressions: we need it
	while ((match = LINE.exec(lines)) != null) {
		const key = match[1]

		// Default undefined or null to empty string
		let value = match[2] || ""

		// Remove whitespace
		value = value.trim()

		// Check if double quoted
		const maybeQuote = value[0]

		// Remove surrounding quotes
		value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2")

		// Expand newlines if double quoted
		if (maybeQuote === '"') {
			value = value.replace(/\\n/g, "\n")
			value = value.replace(/\\r/g, "\r")
		}

		// Add to object
		obj[key] = value
	}

	return obj
}

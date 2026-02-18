export const splitCommand = (input: string): string[] => {
	const trimmed = input.trim()
	if (!trimmed) {
		return []
	}

	const tokens: string[] = []
	let current = ""
	let quote: "single" | "double" | null = null
	let escaped = false

	for (const char of trimmed) {
		if (escaped) {
			current += char
			escaped = false
			continue
		}

		if (char === "\\") {
			if (quote === null) {
				escaped = true
			} else {
				current += char
			}
			continue
		}

		if (quote === "single") {
			if (char === "'") {
				quote = null
			} else {
				current += char
			}
			continue
		}

		if (quote === "double") {
			if (char === '"') {
				quote = null
			} else {
				current += char
			}
			continue
		}

		if (char === "'") {
			quote = "single"
			continue
		}

		if (char === '"') {
			quote = "double"
			continue
		}

		if (/\s/.test(char)) {
			if (current.length > 0) {
				tokens.push(current)
				current = ""
			}
			continue
		}

		current += char
	}

	if (escaped) {
		current += "\\"
	}

	if (quote) {
		throw new Error("Unterminated quote in command.")
	}

	if (current.length > 0) {
		tokens.push(current)
	}

	return tokens
}

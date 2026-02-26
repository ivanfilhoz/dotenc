type ValidationResult = { valid: true } | { valid: false; reason: string }

export const validateKeyName = (name: string): ValidationResult => {
	if (!name) {
		return { valid: false, reason: "Key name must not be empty." }
	}

	if (name === "." || name === "..") {
		return { valid: false, reason: `Invalid key name "${name}".` }
	}

	if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i.test(name)) {
		return {
			valid: false,
			reason: `"${name}" is a reserved name and cannot be used as a key name.`,
		}
	}

	if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
		return {
			valid: false,
			reason: `Invalid key name "${name}". Only letters, numbers, dots, hyphens, and underscores are allowed.`,
		}
	}

	return { valid: true }
}

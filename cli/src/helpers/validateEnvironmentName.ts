type ValidationResult =
	| { valid: true }
	| { valid: false; reason: string }

export const validateEnvironmentName = (name: string): ValidationResult => {
	if (!name) {
		return { valid: false, reason: "Environment name must not be empty." }
	}

	if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
		return {
			valid: false,
			reason: `Invalid environment name "${name}". Only letters, numbers, dots, hyphens, and underscores are allowed.`,
		}
	}

	return { valid: true }
}

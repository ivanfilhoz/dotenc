import crypto from "node:crypto"

/**
 * Computes a hash of the input string.
 */
export const createHash = (input: string) => {
	return crypto.createHash("sha256").update(input).digest("hex")
}

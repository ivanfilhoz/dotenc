import crypto from "node:crypto"

export const getKeyFingerprint = (
	keyInput: Parameters<typeof crypto.createPublicKey>[0],
) => {
	// Normalize the input to a public key
	const publicKey =
		keyInput instanceof crypto.KeyObject && keyInput.type === "public"
			? keyInput
			: crypto.createPublicKey(keyInput)
	// Export the key in DER (binary) format for a stable fingerprint
	const der = publicKey.export({ type: "spki", format: "der" }) as Buffer
	// Create a SHA-256 hash of the DER key; this is the fingerprint
	const hash = crypto.createHash("sha256").update(der).digest("hex")
	return hash
}

import crypto from "node:crypto"

export const getShareableKey = (
	keyInput: Parameters<typeof crypto.createPublicKey>[0],
) => {
	// Normalize the input to a public key
	const publicKey =
		keyInput instanceof crypto.KeyObject && keyInput.type === "public"
			? keyInput
			: crypto.createPublicKey(keyInput)

	// Convert the public key to a PEM format string
	const pemOutput = publicKey.export({ type: "spki", format: "pem" })

	// Convert the PEM string to a base64url encoded string
	const base64Key = pemOutput
		.toString()
		.replace(/-----BEGIN (.*)-----/, "")
		.replace(/-----END (.*)-----/, "")
		.replace(/\s/g, "")
	const base64UrlKey = Buffer.from(base64Key, "base64").toString("base64url")

	return base64UrlKey
}

export const parseShareableKey = (keyString: string) => {
	const base64Key = Buffer.from(keyString, "base64url").toString("base64")

	const match = base64Key.match(/.{1,64}/g)

	if (!match) {
		throw new Error(
			"Invalid shareable key format. Please ensure the key was copied correctly.",
		)
	}

	const finalPemKey = `-----BEGIN PUBLIC KEY-----\n${match.join("\n")}\n-----END PUBLIC KEY-----\n`

	return crypto.createPublicKey(finalPemKey)
}

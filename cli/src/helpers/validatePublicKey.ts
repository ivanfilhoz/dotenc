import type { KeyObject } from "node:crypto"

type ValidationResult = { valid: true } | { valid: false; reason: string }

function getRsaModulusLength(key: KeyObject): number {
	const der = key.export({ type: "spki", format: "der" })
	let i = 0

	// Outer SEQUENCE
	i += 1
	i += der[i] & 0x80 ? (der[i] & 0x7f) + 1 : 1

	// AlgorithmIdentifier SEQUENCE
	i += 1
	let algLen = 0
	if (der[i] & 0x80) {
		const n = der[i] & 0x7f
		for (let j = 1; j <= n; j++) algLen = (algLen << 8) | der[i + j]
		i += n + 1
	} else {
		algLen = der[i]
		i += 1
	}
	i += algLen

	// BIT STRING
	i += 1
	i += der[i] & 0x80 ? (der[i] & 0x7f) + 1 : 1
	i += 1 // unused bits byte

	// Inner SEQUENCE (RSAPublicKey)
	i += 1
	i += der[i] & 0x80 ? (der[i] & 0x7f) + 1 : 1

	// First INTEGER (modulus)
	i += 1
	let modLen = 0
	if (der[i] & 0x80) {
		const n = der[i] & 0x7f
		for (let j = 1; j <= n; j++) modLen = (modLen << 8) | der[i + j]
		i += n + 1
	} else {
		modLen = der[i]
		i += 1
	}

	// Remove leading zero byte used for positive sign
	if (der[i] === 0) modLen -= 1

	return modLen * 8
}

export function validatePublicKey(key: KeyObject): ValidationResult {
	const keyType = key.asymmetricKeyType

	switch (keyType) {
		case "rsa": {
			const modulusLength = getRsaModulusLength(key)
			if (modulusLength < 2048) {
				return {
					valid: false,
					reason: `RSA key is ${modulusLength} bits, minimum is 2048 bits.`,
				}
			}
			return { valid: true }
		}
		case "ed25519":
			return { valid: true }
		case "dsa":
			return {
				valid: false,
				reason: "DSA keys are not supported. Use Ed25519 or RSA (2048+ bits).",
			}
		case "ec":
			return {
				valid: false,
				reason:
					"ECDSA keys are not supported. Use Ed25519 or RSA (2048+ bits).",
			}
		default:
			return {
				valid: false,
				reason: `Unsupported key type: ${keyType}. Use Ed25519 or RSA (2048+ bits).`,
			}
	}
}

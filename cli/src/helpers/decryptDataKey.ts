import crypto from "node:crypto"
import { decrypt, ECIES_CONFIG } from "eciesjs"

ECIES_CONFIG.ellipticCurve = "ed25519"

type PrivateKeyInfo = {
	algorithm: "rsa" | "ed25519"
	privateKey: crypto.KeyObject
	rawSeed?: Buffer
}

/**
 * Decrypts a data key using the appropriate algorithm for the given private key.
 * RSA: uses crypto.privateDecrypt with PKCS1 padding.
 * Ed25519: uses ECIES (eciesjs) with raw 32-byte seed.
 */
export const decryptDataKey = (
	keyInfo: PrivateKeyInfo,
	encryptedDataKey: Buffer,
): Buffer => {
	if (keyInfo.algorithm === "rsa") {
		return crypto.privateDecrypt(
			{
				key: keyInfo.privateKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: "sha256",
			},
			encryptedDataKey,
		)
	}

	if (!keyInfo.rawSeed) {
		throw new Error("Raw seed bytes are required for Ed25519 decryption.")
	}

	return Buffer.from(decrypt(keyInfo.rawSeed, encryptedDataKey))
}

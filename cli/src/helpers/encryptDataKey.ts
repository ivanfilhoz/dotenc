import crypto from "node:crypto"
import { ECIES_CONFIG, encrypt } from "eciesjs"

type PublicKeyInfo = {
	algorithm: "rsa" | "ed25519"
	publicKey: crypto.KeyObject
	rawPublicKey?: Buffer
}

/**
 * Encrypts a data key using the appropriate algorithm for the given public key.
 * RSA: uses crypto.publicEncrypt with PKCS1 padding.
 * Ed25519: uses ECIES (eciesjs) with raw 32-byte public key.
 */
export const encryptDataKey = (
	keyInfo: PublicKeyInfo,
	dataKey: Buffer,
): Buffer => {
	if (keyInfo.algorithm === "rsa") {
		return crypto.publicEncrypt(
			{
				key: keyInfo.publicKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: "sha256",
			},
			dataKey,
		)
	}

	if (!keyInfo.rawPublicKey) {
		throw new Error("Raw public key bytes are required for Ed25519 encryption.")
	}

	const prevCurve = ECIES_CONFIG.ellipticCurve
	ECIES_CONFIG.ellipticCurve = "ed25519"
	try {
		return Buffer.from(encrypt(keyInfo.rawPublicKey, dataKey))
	} finally {
		ECIES_CONFIG.ellipticCurve = prevCurve
	}
}

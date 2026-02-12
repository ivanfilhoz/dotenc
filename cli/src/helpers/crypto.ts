import crypto from "node:crypto"
import { promisify } from "node:util"

const generateKeyPairPromise = promisify(crypto.generateKeyPair)

/**
 * Generates a new key pair
 */
export const generateKeyPair = async () => {
	const { privateKey, publicKey } = await generateKeyPairPromise("rsa", {
		modulusLength: 2048,
	})

	return {
		privateKey: privateKey.export({
			type: "pkcs8",
			format: "pem",
		}),
		publicKey: publicKey.export({
			type: "spki",
			format: "pem",
		}),
	}
}

/**
 * Creates a new data key
 */
export const createDataKey = () => crypto.randomBytes(32)

/**
 * Encrypts a data key using a public key
 */
export const encryptDataKey = (publicKey: string, dataKey: Buffer) => {
	const publicKeyObject = crypto.createPublicKey(publicKey)

	return crypto.publicEncrypt(
		{
			key: publicKeyObject,
			padding: crypto.constants.RSA_PKCS1_PADDING,
		},
		dataKey,
	)
}

/**
 * Decrypts a data key using a private key
 */
export const decryptDataKey = (
	privateKey: string,
	encryptedDataKey: Buffer,
) => {
	const privateKeyObject = crypto.createPrivateKey(privateKey)

	return crypto.privateDecrypt(
		{
			key: privateKeyObject,
			padding: crypto.constants.RSA_PKCS1_PADDING,
		},
		encryptedDataKey,
	)
}

// AES-256-GCM constants
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits, standard for GCM

/**
 * Encrypts a file using AES-256-GCM.
 * @param {Buffer} key - The encryption key (must be 32 bytes for AES-256).
 * @param {string} input - The input string to encrypt.
 */
export async function encryptData(key: Buffer, input: string) {
	if (key.length !== 32) {
		throw new Error("Key must be 32 bytes (256 bits) for AES-256-GCM.")
	}

	// Generate a random IV
	const iv = crypto.randomBytes(IV_LENGTH)

	// Create the cipher
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

	// Encrypt the data
	const encrypted = Buffer.concat([cipher.update(input), cipher.final()])

	// Get the auth tag
	const authTag = cipher.getAuthTag()

	// Combine IV + encrypted content + auth tag
	return Buffer.concat([iv, encrypted, authTag])
}

/**
 * Decrypts a file using AES-256-GCM.
 * @param {Buffer} key - The decryption key (must be 32 bytes for AES-256).
 * @param {string} input - The encrypted content to decrypt.
 */
export async function decryptData(key: Buffer, input: Buffer) {
	if (key.length !== 32) {
		throw new Error("Key must be 32 bytes (256 bits) for AES-256-GCM.")
	}

	// Extract the IV from the start of the file
	const iv = input.subarray(0, IV_LENGTH)

	// Extract the auth tag from the end of the file
	const authTag = input.subarray(input.length - AUTH_TAG_LENGTH)

	// Extract the ciphertext (everything between IV and auth tag)
	const ciphertext = input.subarray(IV_LENGTH, input.length - AUTH_TAG_LENGTH)

	try {
		// Create the decipher
		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
		decipher.setAuthTag(authTag)

		// Decrypt the ciphertext
		const decrypted = Buffer.concat([
			decipher.update(ciphertext),
			decipher.final(),
		])

		return decrypted.toString()
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("unable to authenticate")
		) {
			throw new Error(
				"Failed to decrypt file. This could be because:\n" +
					"1. The encryption key may be incorrect\n" +
					"2. The encrypted file may be corrupted\n" +
					"3. The encrypted file may have been tampered with",
			)
		}
		throw error
	}
}

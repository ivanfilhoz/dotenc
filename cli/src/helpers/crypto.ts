import crypto from "node:crypto"
import fs from "node:fs/promises"

// AES-256-GCM constants
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits, recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits, standard for GCM

/**
 * Encrypts a file using AES-256-GCM.
 * @param {string} token - The encryption key (must be 32 bytes for AES-256).
 * @param {string} input - The input string to encrypt.
 * @param {string} outputFile - Path to the output encrypted file.
 */
export async function encrypt(
	token: string,
	input: string,
	outputFile: string,
) {
	const tokenBuffer = Buffer.from(token, "base64")

	if (tokenBuffer.length !== 32) {
		throw new Error("Token must be 32 bytes (256 bits) for AES-256-GCM.")
	}

	// Generate a random IV
	const iv = crypto.randomBytes(IV_LENGTH)

	// Create the cipher
	const cipher = crypto.createCipheriv(ALGORITHM, tokenBuffer, iv)

	// Encrypt the data
	const encrypted = Buffer.concat([cipher.update(input), cipher.final()])

	// Get the auth tag
	const authTag = cipher.getAuthTag()

	// Combine IV + encrypted content + auth tag
	const result = Buffer.concat([iv, encrypted, authTag])

	// Write the encrypted file
	await fs.writeFile(outputFile, result)
}

/**
 * Decrypts a file using AES-256-GCM.
 * @param {string} token - The decryption key (must be 32 bytes for AES-256).
 * @param {string} inputFile - The input file to decrypt.
 */
export async function decrypt(token: string, inputFile: string) {
	const tokenBuffer = Buffer.from(token, "base64")

	if (tokenBuffer.length !== 32) {
		throw new Error("Token must be 32 bytes (256 bits) for AES-256-GCM.")
	}

	// Read the encrypted file
	const encryptedData = await fs.readFile(inputFile)

	// Extract the IV from the start of the file
	const iv = encryptedData.subarray(0, IV_LENGTH)

	// Extract the auth tag from the end of the file
	const authTag = encryptedData.subarray(encryptedData.length - AUTH_TAG_LENGTH)

	// Extract the ciphertext (everything between IV and auth tag)
	const ciphertext = encryptedData.subarray(
		IV_LENGTH,
		encryptedData.length - AUTH_TAG_LENGTH,
	)

	try {
		// Create the decipher
		const decipher = crypto.createDecipheriv(ALGORITHM, tokenBuffer, iv)
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
					"1. The encryption token may be incorrect\n" +
					"2. The encrypted file may be corrupted\n" +
					"3. The encrypted file may have been tampered with",
			)
		}
		throw error
	}
}

import { z } from "zod"

export const environmentSchema = z.object({
	version: z.number().optional(), // 2 = AAD-bound ciphertext; absent/1 = legacy
	keys: z.array(
		z.object({
			name: z.string(),
			fingerprint: z.string(), // SHA-256 fingerprint of the public key
			encryptedDataKey: z.string(), // Base64 encoded encrypted data key
			algorithm: z.enum(["rsa", "ed25519"]),
		}),
	),
	encryptedContent: z.string(), // Base64 encoded encrypted content
})

export type Environment = z.infer<typeof environmentSchema>

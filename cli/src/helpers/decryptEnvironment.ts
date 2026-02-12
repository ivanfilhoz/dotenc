import crypto from "node:crypto"
import chalk from "chalk"
import type { Environment } from "../schemas/environment"
import { decryptData } from "./crypto"
import { getEnvironmentByName } from "./getEnvironmentByName"
import { getKeyFingerprint } from "./getKeyFingerprint"
import { getPrivateKeys } from "./getPrivateKeys"

export const decryptEnvironment = async (name: string) => {
	const availablePrivateKeys = await getPrivateKeys()

	if (process.env.DOTENC_PRIVATE_KEY) {
		const privateKey = crypto.createPrivateKey(process.env.DOTENC_PRIVATE_KEY)

		availablePrivateKeys.push({
			name: "<env.DOTENC_PRIVATE_KEY>",
			privateKey,
			fingerprint: getKeyFingerprint(privateKey),
		})
	}

	if (!availablePrivateKeys.length) {
		throw new Error(
			"No private keys found. Please generate a private key using 'dotenc key generate' or import one using 'dotenc key import'.",
		)
	}

	const environmentJson = await getEnvironmentByName(name)
	let grantedKey: Environment["keys"][number] | undefined
	let selectedPrivateKey: crypto.KeyObject | undefined

	for (const { privateKey, fingerprint } of availablePrivateKeys) {
		grantedKey = environmentJson.keys.find((key) => {
			return key.fingerprint === fingerprint
		})

		if (grantedKey) {
			selectedPrivateKey = privateKey
			break
		}
	}

	if (!grantedKey || !selectedPrivateKey) {
		console.error(
			`You do not have access to this environment.\n
      These are your available private keys:\n
      ${availablePrivateKeys.map((key) => `- ${chalk.green(key.name)}`).join("\n")}\n
      Please ask the owners of any of the following keys to grant you access:\n
      ${environmentJson.keys.map((key) => `- ${chalk.green(key.name)}`).join("\n")}\n`,
		)
		throw new Error("Access denied to the environment.")
	}

	let dataKey: Buffer
	try {
		dataKey = crypto.privateDecrypt(
			selectedPrivateKey,
			Buffer.from(grantedKey.encryptedDataKey, "base64"),
		)
	} catch (error) {
		console.error(
			`${chalk.red("Error:")} failed to decrypt the data key. Please ensure you have the correct private key.`,
		)
		throw new Error("Failed to decrypt the data key.", { cause: error })
	}

	const decryptedContent = await decryptData(
		dataKey,
		Buffer.from(environmentJson.encryptedContent, "base64"),
	)

	return decryptedContent
}

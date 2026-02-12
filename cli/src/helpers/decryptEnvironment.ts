import chalk from "chalk"
import type { Environment } from "../schemas/environment"
import { decryptData } from "./crypto"
import { decryptDataKey } from "./decryptDataKey"
import { getEnvironmentByName } from "./getEnvironmentByName"
import { getPrivateKeys, type PrivateKeyEntry } from "./getPrivateKeys"

export const decryptEnvironment = async (name: string) => {
	const availablePrivateKeys = await getPrivateKeys()

	if (!availablePrivateKeys.length) {
		throw new Error(
			"No private keys found. Please ensure you have SSH keys in ~/.ssh/ or set the DOTENC_PRIVATE_KEY environment variable.",
		)
	}

	const environmentJson = await getEnvironmentByName(name)
	let grantedKey: Environment["keys"][number] | undefined
	let selectedPrivateKey: PrivateKeyEntry | undefined

	for (const privateKeyEntry of availablePrivateKeys) {
		grantedKey = environmentJson.keys.find((key) => {
			return key.fingerprint === privateKeyEntry.fingerprint
		})

		if (grantedKey) {
			selectedPrivateKey = privateKeyEntry
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
		dataKey = decryptDataKey(
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

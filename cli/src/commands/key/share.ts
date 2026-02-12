import chalk from "chalk"
import { getPrivateKeyByName } from "../../helpers/getPrivateKeyByName"
import { choosePrivateKeyPrompt } from "../../prompts/choosePrivateKey"

export const keyShareCommand = async (nameArg: string) => {
	let name = nameArg

	if (!name) {
		name = await choosePrivateKeyPrompt(
			"What private key do you want to share? A shareable public key will be generated from it.",
		)
	}

	const key = await getPrivateKeyByName(name)
	const pemOutput = key.export({ type: "spki", format: "pem" })

	const base64Key = pemOutput
		.toString()
		.replace(/-----BEGIN (.*)-----/, "")
		.replace(/-----END (.*)-----/, "")
		.replace(/\s/g, "")

	const base64UrlKey = Buffer.from(base64Key, "base64").toString("base64url")

	console.log(`Shareable public key for ${chalk.cyan(name)}:\n`)
	console.log(base64UrlKey)
}

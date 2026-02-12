import chalk from "chalk"
import { getPrivateKeyByName } from "../../helpers/getPrivateKeyByName"
import { choosePrivateKeyPrompt } from "../../prompts/choosePrivateKey"

type Options = {
	public?: boolean
}

export const keyExportCommand = async (nameArg: string, options: Options) => {
	let name = nameArg

	if (!name) {
		name = await choosePrivateKeyPrompt(
			"What private key do you want to export?",
		)
	}

	const key = await getPrivateKeyByName(name)

	if (options.public) {
		const publicKeyOutput = key.export({ type: "spki", format: "pem" })

		console.log(`Public key for ${chalk.cyan(name)}:\n`)
		console.log(publicKeyOutput)
		return
	}

	const privateKeyOutput = key.export({ type: "pkcs8", format: "pem" })
	console.log(`Private key ${chalk.cyan(name)}:\n`)
	console.log(privateKeyOutput)
}

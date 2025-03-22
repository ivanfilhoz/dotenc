import { existsSync } from "node:fs"
import path from "node:path"
import { encrypt } from "./crypto"

export const createEnvironment = async (name: string, key: string) => {
	const filePath = path.join(process.cwd(), `.env.${name}.enc`)

	if (existsSync(filePath)) {
		throw new Error(`Environment "${name}" already exists.`)
	}

	await encrypt(key, `# ${name} environment\n`, filePath)
}

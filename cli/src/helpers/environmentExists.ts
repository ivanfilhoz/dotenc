import { existsSync } from "node:fs"
import path from "node:path"

export const environmentExists = (environment: string, dir?: string) => {
	const resolvedDir = dir ?? process.cwd()
	const envPath = path.join(resolvedDir, `.env.${environment}.enc`)
	return existsSync(envPath)
}

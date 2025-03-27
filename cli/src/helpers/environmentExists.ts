import { existsSync } from "node:fs"
import path from "node:path"

export const environmentExists = (environment: string) => {
	const envPath = path.join(process.cwd(), `.env.${environment}.enc`)
	return existsSync(envPath)
}

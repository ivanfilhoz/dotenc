import path from "node:path"
import { getEnvironmentByPath } from "./getEnvironmentByPath"

export const getEnvironmentByName = async (name: string, dir?: string) => {
	const resolvedDir = dir ?? process.cwd()
	return getEnvironmentByPath(path.join(resolvedDir, `.env.${name}.enc`))
}

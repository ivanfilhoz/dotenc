import path from "node:path"
import { getEnvironmentByPath } from "./getEnvironmentByPath"

export const getEnvironmentByName = async (name: string) => {
	return getEnvironmentByPath(path.join(process.cwd(), `.env.${name}.enc`))
}

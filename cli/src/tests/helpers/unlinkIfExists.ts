import { existsSync, unlinkSync } from "fs"

export const unlinkIfExists = (filePath: string) => {
	if (existsSync(filePath)) {
		unlinkSync(filePath)
	}
}

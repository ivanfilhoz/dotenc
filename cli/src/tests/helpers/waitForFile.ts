import { existsSync, readFileSync } from "node:fs"

export const waitForFile = (filePath: string, timeout = 5000) =>
	new Promise((resolve, reject) => {
		const startTime = Date.now()
		const interval = setInterval(() => {
			if (existsSync(filePath)) {
				clearInterval(interval)
				resolve(readFileSync(filePath, "utf-8"))
				return
			}

			if (Date.now() - startTime > timeout) {
				clearInterval(interval)
				reject(new Error(`Timeout waiting for file ${filePath}`))
			}
		}, 100)
	})

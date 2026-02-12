import fs from "node:fs/promises"

export const getEnvironments = async () => {
	const files = await fs.readdir(process.cwd())
	const envFiles = files.filter(
		(file) => file.startsWith(".env.") && file.endsWith(".enc"),
	)

	return envFiles.map(
		(file) => file.slice(5, -4), // Remove ".env." prefix and ".enc" suffix
	)
}

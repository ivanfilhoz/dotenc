import os from "node:os"
import path from "node:path"

export const resolveProjectRoot = (
	startDir: string,
	existsSync: (p: string) => boolean,
): string => {
	let dir = path.resolve(startDir)

	// eslint-disable-next-line no-constant-condition
	while (true) {
		// Skip the home directory — ~/.dotenc is reserved for global config, not projects
		if (dir !== os.homedir() && existsSync(path.join(dir, ".dotenc"))) {
			return dir
		}

		const parent = path.dirname(dir)
		if (parent === dir) {
			throw new Error(
				'Not in a dotenc project. Run "dotenc init" to initialize.',
			)
		}

		dir = parent
	}
}

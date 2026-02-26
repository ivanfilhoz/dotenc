import pkg from "../../package.json"
import { formatUpdateNotice } from "../helpers/updateNotifier"

const bumpPatchVersion = (version: string): string => {
	const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/)
	if (!match) {
		return "7.46.0"
	}

	const [, major, minor, patch] = match
	return `${major}.${minor}.${Number(patch) + 1}`
}

export const mockUpdateCommand = (
	currentVersion?: string,
	latestVersion?: string,
) => {
	const current = currentVersion ?? pkg.version
	const latest = latestVersion ?? bumpPatchVersion(current)
	console.log(formatUpdateNotice(current, latest))
}

import chalk from "chalk"
import pkg from "../../package.json"
import { getHomeConfig, setHomeConfig } from "./homeConfig"
import { fetchLatestVersion, isVersionNewer } from "./update"

type HomeConfig = Awaited<ReturnType<typeof getHomeConfig>>

type UpdateNotifierDeps = {
	getHomeConfig: typeof getHomeConfig
	setHomeConfig: typeof setHomeConfig
	fetchLatestVersion: typeof fetchLatestVersion
	currentVersion: string
	now: () => number
	log: (message: string) => void
	args: string[]
	env: NodeJS.ProcessEnv
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

const defaultDeps: UpdateNotifierDeps = {
	getHomeConfig,
	setHomeConfig,
	fetchLatestVersion,
	currentVersion: pkg.version,
	now: () => Date.now(),
	log: console.log,
	args: process.argv.slice(2),
	env: process.env,
}

const shouldSkipCheck = (args: string[], env: NodeJS.ProcessEnv): boolean => {
	if (env.DOTENC_SKIP_UPDATE_CHECK === "1") {
		return true
	}

	const firstArg = args[0]
	if (!firstArg) return false

	return ["update", "--help", "-h", "--version", "-V", "help"].includes(
		firstArg,
	)
}

const parseTimestamp = (value?: string | null): number => {
	if (!value) return 0
	const parsed = Date.parse(value)
	return Number.isNaN(parsed) ? 0 : parsed
}

const persistUpdateState = async (
	config: HomeConfig,
	updateState: NonNullable<HomeConfig["update"]>,
	deps: UpdateNotifierDeps,
) => {
	try {
		await deps.setHomeConfig({
			...config,
			update: updateState,
		})
	} catch {
		// Never fail command execution because of update-check persistence.
	}
}

export const maybeNotifyAboutUpdate = async (
	depsOverrides: Partial<UpdateNotifierDeps> = {},
) => {
	const deps: UpdateNotifierDeps = {
		...defaultDeps,
		...depsOverrides,
	}

	if (shouldSkipCheck(deps.args, deps.env)) {
		return
	}

	let config: HomeConfig = {}
	try {
		config = await deps.getHomeConfig()
	} catch {
		config = {}
	}

	let updateState = config.update ?? {}
	let latestVersion = updateState.latestVersion ?? null
	const now = deps.now()
	const lastCheckedAt = parseTimestamp(updateState.lastCheckedAt)
	const shouldRefresh =
		!latestVersion || now - lastCheckedAt >= CHECK_INTERVAL_MS

	if (shouldRefresh) {
		const fetchedVersion = await deps.fetchLatestVersion()
		updateState = {
			...updateState,
			lastCheckedAt: new Date(now).toISOString(),
			latestVersion: fetchedVersion ?? latestVersion ?? undefined,
		}
		latestVersion = updateState.latestVersion ?? null
		await persistUpdateState(config, updateState, deps)
	}

	if (!latestVersion || !isVersionNewer(latestVersion, deps.currentVersion)) {
		return
	}

	if (updateState.notifiedVersion === latestVersion) {
		return
	}

	deps.log(
		`${chalk.yellow("Update available:")} ${chalk.gray(`dotenc ${deps.currentVersion}`)} -> ${chalk.cyan(`dotenc ${latestVersion}`)}. Run ${chalk.gray("dotenc update")}.`,
	)

	updateState = {
		...updateState,
		notifiedVersion: latestVersion,
	}
	await persistUpdateState(config, updateState, deps)
}

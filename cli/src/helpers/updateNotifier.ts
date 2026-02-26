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
	log: (message: string) => void
	args: string[]
}

const UPDATE_BOX_TITLE = "UPDATE AVAILABLE"
const BOX_PADDING = 3
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

type UpdateNoticeLine = {
	visible: string
	colored: string
}

export const formatUpdateNotice = (
	currentVersion: string,
	latestVersion: string,
): string => {
	const lines: UpdateNoticeLine[] = [
		{ visible: "", colored: "" },
		{
			visible: `Update available: ${currentVersion} -> ${latestVersion}`,
			colored: `Update available: ${chalk.gray(currentVersion)} -> ${chalk.cyan(latestVersion)}`,
		},
		{ visible: "", colored: "" },
		{
			visible: "Run dotenc update to update",
			colored: `Run ${chalk.gray("dotenc update")} to update`,
		},
		{ visible: "", colored: "" },
	]

	const contentWidth = Math.max(
		...lines.map((line) => line.visible.length + BOX_PADDING * 2),
	)
	const titleWithSpacing = ` ${UPDATE_BOX_TITLE} `
	const innerWidth = Math.max(contentWidth, titleWithSpacing.length + 2)

	const leftBorderWidth = Math.floor((innerWidth - titleWithSpacing.length) / 2)
	const rightBorderWidth =
		innerWidth - titleWithSpacing.length - leftBorderWidth
	const topBorder = `╭${"─".repeat(leftBorderWidth)}${titleWithSpacing}${"─".repeat(rightBorderWidth)}╮`
	const bottomBorder = `╰${"─".repeat(innerWidth)}╯`
	const body = lines.map((line) => {
		const padding = " ".repeat(BOX_PADDING)
		const visibleLength = line.colored.replace(ANSI_PATTERN, "").length
		const trailingPadding = " ".repeat(
			innerWidth - BOX_PADDING * 2 - visibleLength,
		)
		return `${chalk.yellow("│")}${padding}${line.colored}${padding}${trailingPadding}${chalk.yellow("│")}`
	})

	return [chalk.yellow(topBorder), ...body, chalk.yellow(bottomBorder)].join(
		"\n",
	)
}

const defaultDeps: UpdateNotifierDeps = {
	getHomeConfig,
	setHomeConfig,
	fetchLatestVersion,
	currentVersion: pkg.version,
	log: console.log,
	args: process.argv.slice(2),
}

const shouldCheckForUpdate = (args: string[]): boolean => args[0] === "dev"

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

	if (!shouldCheckForUpdate(deps.args)) {
		return
	}

	let config: HomeConfig = {}
	try {
		config = await deps.getHomeConfig()
	} catch {
		config = {}
	}

	let updateState = config.update ?? {}
	const latestVersion = await deps.fetchLatestVersion()

	if (!latestVersion || !isVersionNewer(latestVersion, deps.currentVersion)) {
		return
	}

	if (updateState.notifiedVersion === latestVersion) {
		return
	}

	deps.log(formatUpdateNotice(deps.currentVersion, latestVersion))

	updateState = {
		...updateState,
		latestVersion,
		notifiedVersion: latestVersion,
	}
	await persistUpdateState(config, updateState, deps)
}

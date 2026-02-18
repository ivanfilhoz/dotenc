import chalk from "chalk"
import { getHomeConfig, setHomeConfig } from "../helpers/homeConfig"

type Options = {
	remove: boolean
}

type ConfigCommandDeps = {
	getHomeConfig: typeof getHomeConfig
	setHomeConfig: typeof setHomeConfig
	log: (message: string) => void
	logError: (message: string) => void
	exit: (code: number) => never
}

const SUPPORTED_CONFIG_KEYS = ["editor"] as const
type SupportedConfigKey = (typeof SUPPORTED_CONFIG_KEYS)[number]

const defaultDeps: ConfigCommandDeps = {
	getHomeConfig,
	setHomeConfig,
	log: (message) => console.log(message),
	logError: (message) => console.error(message),
	exit: (code) => process.exit(code),
}

const getSupportedConfigKey = (
	key: string,
): { valid: true; key: SupportedConfigKey } | { valid: false } => {
	if (SUPPORTED_CONFIG_KEYS.includes(key as SupportedConfigKey)) {
		return { valid: true, key: key as SupportedConfigKey }
	}
	return { valid: false }
}

export const configCommand = async (
	key: string,
	value: string | undefined,
	options: Options,
	deps: ConfigCommandDeps = defaultDeps,
) => {
	const keyValidation = getSupportedConfigKey(key)
	if (!keyValidation.valid) {
		deps.logError(
			`${chalk.red("Error:")} unsupported config key "${key}". Supported keys: ${SUPPORTED_CONFIG_KEYS.join(", ")}.`,
		)
		deps.exit(1)
	}

	const config = await deps.getHomeConfig()
	const configKey = keyValidation.key

	if (options.remove) {
		delete config[configKey]
		await deps.setHomeConfig(config)
		return
	}

	if (value !== undefined) {
		config[configKey] = value
		await deps.setHomeConfig(config)
		return
	}

	deps.log(config[configKey] ?? "")
}

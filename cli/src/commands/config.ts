import { getHomeConfig, setHomeConfig } from "../helpers/homeConfig"

type Options = {
	remove: boolean
}

export const configCommand = async (
	key: string,
	value: string,
	options: Options,
) => {
	const config = await getHomeConfig()

	if (options.remove) {
		delete config[key as keyof typeof config]
		await setHomeConfig(config)
		return
	}

	if (value) {
		config[key as keyof typeof config] = value
		await setHomeConfig(config)
		return
	}

	console.log(config[key as keyof typeof config])
}

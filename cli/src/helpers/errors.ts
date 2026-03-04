import chalk from "chalk"

export const passphraseProtectedKeyError = (keys: string[]) =>
	`${chalk.red("Error:")} dotenc could not use passphrase-protected SSH keys.\n\nPassphrase-protected keys found:\n${keys.map((k) => `  - ${k}`).join("\n")}\n\nTo use passphrase-protected keys directly, set:\n  ${chalk.gray("DOTENC_PRIVATE_KEY_PASSPHRASE=<your-passphrase>")}\n\nOr create/select a passwordless key for dotenc.`

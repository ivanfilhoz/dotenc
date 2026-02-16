import chalk from "chalk"

export const passphraseProtectedKeyError = (keys: string[]) =>
	`${chalk.red("Error:")} your SSH keys are passphrase-protected, which is not currently supported by dotenc.\n\nPassphrase-protected keys found:\n${keys.map((k) => `  - ${k}`).join("\n")}\n\nTo generate a key without a passphrase:\n  ${chalk.gray('ssh-keygen -t ed25519 -N ""')}\n\nOr use an existing key without a passphrase.`

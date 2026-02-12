import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Command, Option } from "commander"
import { configCommand } from "./commands/config"
import { createCommand } from "./commands/create"
import { editCommand } from "./commands/edit"
import { grantCommand } from "./commands/grant"
import { initCommand } from "./commands/init"
import { keyAddCommand } from "./commands/key/add"
import { keyExportCommand } from "./commands/key/export"
import { keyGenerateCommand } from "./commands/key/generate"
import { keyImportCommand } from "./commands/key/import"
import { keyShareCommand } from "./commands/key/share"
import { revokeCommand } from "./commands/revoke"
import { runCommand } from "./commands/run"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkg = JSON.parse(
	fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
)

const program = new Command()

program.name("dotenc").description(pkg.description).version(pkg.version)

program
	.command("init")
	.description("initialize a dotenc project in the current directory")
	.action(initCommand)

program
	.command("create")
	.argument("[environment]", "the name of the new environment")
	.argument(
		"[publicKey]",
		"the name of the public key to grant access to the environment",
	)
	.description("create a new environment")
	.action(createCommand)

program
	.command("edit")
	.argument("[environment]", "the environment to edit")
	.description("edit an environment")
	.action(editCommand)

program
	.command("grant")
	.argument("[environment]", "the environment to grant access to")
	.argument(
		"[publicKey]",
		"the name of the public key to grant access to the environment",
	)
	.description("grant access to an environment")
	.action(grantCommand)

program
	.command("revoke")
	.argument("[environment]", "the environment to revoke access from")
	.argument(
		"[publicKey]",
		"the name of the public key to revoke access from the environment",
	)
	.description("revoke access from an environment")
	.action(revokeCommand)

program
	.command("run")
	.argument("<command>", "the command to run")
	.argument("[args...]", "the arguments to pass to the command")
	.addOption(
		new Option(
			"-e, --env <env1>[,env2[,...]]",
			"the environments to run the command in",
		),
	)
	.description("run a command in an environment")
	.action(runCommand)

const key = program.command("key").description("manage keys")

key
	.command("generate")
	.argument("[name]", "the name of the new key")
	.description("generate a new private key")
	.action(keyGenerateCommand)

key
	.command("share")
	.argument("[name]", "the name of the key to share")
	.description("generate a shareable public key from a private key")
	.action(keyShareCommand)

key
	.command("add")
	.argument(
		"[name]",
		"if provided, the public key will be derived from one of your existing private keys",
	)
	.addOption(new Option("-f, --from-file <file>", "add the key from a file"))
	.addOption(
		new Option("-s, --from-string <string>", "add a public key from a string"),
	)
	.description("add a public key to the project")
	.action(keyAddCommand)

key
	.command("import")
	.argument("[name]", "the name of the new private key")
	.addOption(new Option("-f, --from-file <file>", "import the key from a file"))
	.addOption(
		new Option(
			"-s, --from-string <string>",
			"import a private key from a string",
		),
	)
	.description("import a key to your local key store")
	.action(keyImportCommand)

key
	.command("export")
	.argument("[name]", "the name of the private key to export")
	.addOption(
		new Option(
			"-p, --public",
			"export a generated public key instead of the private key",
		),
	)
	.description(
		"export a private key from the local key store or its derived public key",
	)
	.action(keyExportCommand)

program
	.command("config")
	.argument("<key>", "the key to get or set")
	.argument("[value]", "the value to set the key to")
	.addOption(new Option("-r, --remove", "remove a configuration key"))
	.description("manage global configuration")
	.action(configCommand)

program.parse()

import { Command, Option } from "commander"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { configCommand } from "./commands/config"
import { debugCommand } from "./commands/debug"
import { editCommand } from "./commands/edit"
import { initCommand } from "./commands/init"
import { keyExportCommand } from "./commands/key/export"
import { keyImportCommand } from "./commands/key/import"
import { runCommand } from "./commands/run"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkg = JSON.parse(
	fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"),
)

const program = new Command()

program.name("dotenc").description(pkg.description).version(pkg.version)

if (process.env.NODE_ENV !== "production") {
	program.command("debug").description("debug the CLI").action(debugCommand)
}

program
	.command("init")
	.argument("[environment]", "the environment to initialize")
	.description("initialize a new environment")
	.action(initCommand)

program
	.command("edit")
	.argument("[environment]", "the environment to edit")
	.description("edit an environment")
	.action(editCommand)

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

const key = program.command("key").description("manage stored keys")
key
	.command("import")
	.argument("[environment]", "the environment to import the key to")
	.argument("[key]", "the key to import")
	.description("import a key for an environment")
	.action(keyImportCommand)

key
	.command("export")
	.argument("[environment]", "the environment to export the key from")
	.description("export a key from an environment")
	.action(keyExportCommand)

program
	.command("config")
	.argument("<key>", "the key to get or set")
	.argument("[value]", "the value to set the key to")
	.addOption(new Option("-r, --remove", "remove a configuration key"))
	.description("manage global configuration")
	.action(configCommand)

program.parse()

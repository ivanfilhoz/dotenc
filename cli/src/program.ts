import { Command, Option } from "commander"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { configCommand } from "./commands/config"
import { debugCommand } from "./commands/debug"
import { editCommand } from "./commands/edit"
import { initCommand } from "./commands/init"
import { runCommand } from "./commands/run"
import { tokenExportCommand } from "./commands/token/export"
import { tokenImportCommand } from "./commands/token/import"

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
	.command("init [environment]")
	.description("initialize a new environment")
	.action(initCommand)

program
	.command("edit [environment]")
	.description("edit an environment")
	.action(editCommand)

program
	.command("run <command> [args...]")
	.addOption(
		new Option(
			"-e, --environment <environment>",
			"the environment to run the command in",
		),
	)
	.description("run a command in an environment")
	.action(runCommand)

const token = program.command("token").description("Manage stored tokens")
token
	.command("import <environment> <token>")
	.description("import a token for an environment")
	.action(tokenImportCommand)

token
	.command("export <environment>")
	.description("export a token from an environment")
	.action(tokenExportCommand)

program
	.command("config <key> [value]")
	.addOption(new Option("-r, --remove", "remove a configuration key"))
	.description("manage global configuration")
	.action(configCommand)

program.parse()

#!/usr/bin/env node

import { Command, Option } from "commander"
import pkg from "../package.json" assert { type: "json" }
import { configCommand } from "./commands/config"
import { debugCommand } from "./commands/debug"
import { editCommand } from "./commands/edit"
import { initCommand } from "./commands/init"
import { runCommand } from "./commands/run"
import { tokenExportCommand } from "./commands/token/export"
import { tokenImportCommand } from "./commands/token/import"

const program = new Command()

program.name("safe-env").description(pkg.description).version(pkg.version)

if (process.env.NODE_ENV !== "production") {
	program.command("debug").description("Debug the CLI").action(debugCommand)
}

program
	.command("init [environment]")
	.description("Initialize a new safe environment")
	.action(initCommand)

program
	.command("edit [environment]")
	.description("Edit an environment")
	.action(editCommand)

program
	.command("run <environment> <command> [args...]")
	.description("Run a command in an environment")
	.action(runCommand)

const token = program.command("token").description("Manage stored tokens")
token
	.command("import <environment> <token>")
	.description("Import a token for an environment")
	.action(tokenImportCommand)

token
	.command("export <environment>")
	.description("Export a token from an environment")
	.action(tokenExportCommand)

program
	.command("config <key> [value]")
	.addOption(new Option("-r, --remove", "Remove a configuration key"))
	.description("Manage global configuration")
	.action(configCommand)

program.parse()

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
import { keyRemoveCommand } from "./commands/key/remove"
import { revokeCommand } from "./commands/revoke"
import { rotateCommand } from "./commands/rotate"
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
	.command("rotate")
	.argument("[environment]", "the environment to rotate the data key for")
	.description("rotate the data key for an environment")
	.action(rotateCommand)

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
	.command("add")
	.argument("[name]", "the name of the public key in the project")
	.addOption(
		new Option(
			"--from-ssh <path>",
			"add a public key derived from an SSH key file",
		),
	)
	.addOption(new Option("-f, --from-file <file>", "add the key from a PEM file"))
	.addOption(
		new Option("-s, --from-string <string>", "add a public key from a string"),
	)
	.description("add a public key to the project")
	.action(keyAddCommand)

key
	.command("remove")
	.argument("[name]", "the name of the public key to remove")
	.description("remove a public key from the project")
	.action(keyRemoveCommand)

program
	.command("config")
	.argument("<key>", "the key to get or set")
	.argument("[value]", "the value to set the key to")
	.addOption(new Option("-r, --remove", "remove a configuration key"))
	.description("manage global configuration")
	.action(configCommand)

program.parse()

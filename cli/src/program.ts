import { Command, Option } from "commander"
import pkg from "../package.json"
import { grantCommand } from "./commands/auth/grant"
import { authListCommand } from "./commands/auth/list"
import { revokeCommand } from "./commands/auth/revoke"
import { configCommand } from "./commands/config"
import { devCommand } from "./commands/dev"
import { createCommand } from "./commands/env/create"
import { decryptCommand } from "./commands/env/decrypt"
import { editCommand } from "./commands/env/edit"
import { encryptCommand } from "./commands/env/encrypt"
import { envListCommand } from "./commands/env/list"
import { rotateCommand } from "./commands/env/rotate"
import { initCommand } from "./commands/init"
import { keyAddCommand } from "./commands/key/add"
import { keyListCommand } from "./commands/key/list"
import { keyRemoveCommand } from "./commands/key/remove"
import { runCommand } from "./commands/run"
import { textconvCommand } from "./commands/textconv"
import { installAgentSkillCommand } from "./commands/tools/install-agent-skill"
import { installVscodeExtensionCommand } from "./commands/tools/install-vscode-extension"
import { whoamiCommand } from "./commands/whoami"

const program = new Command()

program.name("dotenc").description(pkg.description).version(pkg.version)

program
	.command("init")
	.addOption(new Option("-n, --name <name>", "your username for the project"))
	.description("initialize a dotenc project in the current directory")
	.action(initCommand)

const env = program.command("env").description("manage environments")

env
	.command("create")
	.argument("[environment]", "the name of the new environment")
	.argument(
		"[publicKey]",
		"the name of the public key to grant access to the environment",
	)
	.description("create a new environment")
	.action((env, pubKey) => createCommand(env, pubKey))

env
	.command("edit")
	.argument("[environment]", "the environment to edit")
	.description("edit an environment")
	.action(editCommand)

env
	.command("decrypt", { hidden: true })
	.argument("<environment>", "the environment to decrypt")
	.addOption(new Option("--json", "output machine-readable JSON"))
	.description("decrypt an environment and print plaintext to stdout")
	.action(decryptCommand)

env
	.command("encrypt", { hidden: true })
	.argument("<environment>", "the environment to encrypt")
	.addOption(new Option("--stdin", "read plaintext content from stdin"))
	.addOption(new Option("--json", "output machine-readable JSON"))
	.description("encrypt plaintext content and write it to an environment file")
	.action(encryptCommand)

env
	.command("rotate")
	.argument("[environment]", "the environment to rotate the data key for")
	.description("rotate the data key for an environment")
	.action(rotateCommand)

env.command("list").description("list all environments").action(envListCommand)

const auth = program.command("auth").description("manage environment access")

auth
	.command("grant")
	.argument("[environment]", "the environment to grant access to")
	.argument(
		"[publicKey]",
		"the name of the public key to grant access to the environment",
	)
	.description("grant access to an environment")
	.action(grantCommand)

auth
	.command("revoke")
	.argument("[environment]", "the environment to revoke access from")
	.argument(
		"[publicKey]",
		"the name of the public key to revoke access from the environment",
	)
	.description("revoke access from an environment")
	.action(revokeCommand)

auth
	.command("list")
	.argument("[environment]", "the environment to list access for")
	.description("list keys with access to an environment")
	.action(authListCommand)

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

program
	.command("dev")
	.argument("<command>", "the command to run")
	.argument("[args...]", "the arguments to pass to the command")
	.description("shortcut for 'run -e development,<yourname> <command>'")
	.action((command, args) => devCommand(command, args))

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
	.addOption(
		new Option("-f, --from-file <file>", "add the key from a PEM file"),
	)
	.addOption(
		new Option("-s, --from-string <string>", "add a public key from a string"),
	)
	.description("add a public key to the project")
	.action(keyAddCommand)

key
	.command("list")
	.description("list all public keys in the project")
	.action(keyListCommand)

key
	.command("remove")
	.argument("[name]", "the name of the public key to remove")
	.description("remove a public key from the project")
	.action(keyRemoveCommand)

const tools = program
	.command("tools")
	.description("install editor integrations")

tools
	.command("install-agent-skill")
	.addOption(new Option("--force", "overwrite existing installation"))
	.description("install the agent skill for this project")
	.action(installAgentSkillCommand)

tools
	.command("install-vscode-extension")
	.description(
		"add dotenc to VS Code / Cursor / Windsurf extension recommendations",
	)
	.action(installVscodeExtensionCommand)

program
	.command("textconv", { hidden: true })
	.argument("<filepath>", "path to the encrypted environment file")
	.description("decrypt an environment file for git diff")
	.action(textconvCommand)

program
	.command("whoami")
	.description("show your identity in this project")
	.action(whoamiCommand)

program
	.command("config")
	.argument("<key>", "the key to get or set")
	.argument("[value]", "the value to set the key to")
	.addOption(new Option("-r, --remove", "remove a configuration key"))
	.description("manage global configuration")
	.action(configCommand)

program.parse()

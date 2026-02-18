---
name: dotenc
description: Operate dotenc encrypted environments and access control in repositories that use dotenc. Use when users need to initialize dotenc, create/edit/list environments, run commands with injected secrets, manage public keys, grant/revoke access, offboard teammates, install dotenc agent/editor integrations, or troubleshoot dotenc CLI workflows.
allowed-tools: Bash, Read, Glob, Grep
argument-hint: [command]
---

# Dotenc Skill

Use this skill for dotenc CLI `0.6.x`.

## Start with read-only checks

If `dotenc` is missing, install it first (default method):

```bash
if ! command -v dotenc >/dev/null 2>&1; then
  curl -fsSL https://dotenc.org/install.sh | sh
  hash -r
fi
```

Then run:

```bash
dotenc --version
dotenc whoami || true
dotenc env list || true
dotenc key list || true
```

If the project is not initialized, run:

```bash
dotenc init --name <username>
```

`dotenc init`:
- adds your public key to `.dotenc/`
- configures git diff textconv for `.env.*.enc`
- creates `.env.development.enc`
- creates `.env.<username>.enc` when `<username>` is not `development`

## Core workflows

### Create and edit environments

```bash
dotenc env create <environment> <publicKey>
dotenc env edit <environment>
dotenc env list
```

### Run commands with secrets

```bash
dotenc dev <command> [args...]
dotenc run -e <env1>[,env2[,...]] <command> [args...]
dotenc run --strict -e <env1>[,env2[,...]] <command> [args...]
```

When running multiple environments, values from later environments override earlier ones.
Use `--strict` when partial environment load should fail the command.

### Onboard a teammate

```bash
dotenc key add <teammate> --from-file /path/to/<teammate>.pub
dotenc auth grant development <teammate>
dotenc auth grant production <teammate>  # only when needed
```

### Offboard a teammate

```bash
dotenc key remove <teammate>
```

`dotenc key remove` removes the key and attempts to revoke and re-encrypt all affected environments automatically.

### Add a CI/CD key

```bash
dotenc key add ci --from-file /path/to/ci.pub
dotenc auth grant production ci
```

### Install integrations

```bash
dotenc tools install-agent-skill
dotenc tools install-agent-skill --force
dotenc tools install-vscode-extension
```

`dotenc tools install-agent-skill` asks whether to install locally or globally.

### Update dotenc

```bash
dotenc update
```

## Command reference

### Initialization and identity

| Command | Description |
|---------|-------------|
| `dotenc init [--name <name>]` | Initialize dotenc in the current repository |
| `dotenc whoami` | Show detected identity and environment access |
| `dotenc config editor [value] [--remove]` | Get/set/remove global editor command |

### Environments

| Command | Description |
|---------|-------------|
| `dotenc env list` | List encrypted environments |
| `dotenc env create [environment] [publicKey]` | Create a new encrypted environment |
| `dotenc env edit [environment]` | Edit and re-encrypt an environment |
| `dotenc env rotate [environment]` | Re-encrypt environment with a fresh data key |
| `dotenc env decrypt <environment> [--json]` | Hidden: decrypt to stdout (machine use) |
| `dotenc env encrypt <environment> [--stdin] [--json]` | Hidden: encrypt plaintext input (machine use) |

### Access control

| Command | Description |
|---------|-------------|
| `dotenc auth list [environment]` | List keys with access |
| `dotenc auth grant [environment] [publicKey]` | Grant access |
| `dotenc auth revoke [environment] [publicKey]` | Revoke access |

### Key management

| Command | Description |
|---------|-------------|
| `dotenc key list` | List project public keys |
| `dotenc key add [name] [--from-ssh <path>] [--from-file <file>] [--from-string <string>]` | Add a key |
| `dotenc key remove [name]` | Remove a key and revoke from environments |

### Command execution

| Command | Description |
|---------|-------------|
| `dotenc run -e <env1>[,env2[,...]] <command> [args...]` | Run command with injected variables |
| `dotenc run --strict -e <env1>[,env2[,...]] <command> [args...]` | Fail if any selected environment fails to load |
| `dotenc dev <command> [args...]` | Shortcut for `run -e development,<your-key-name>` |

### Integrations and maintenance

| Command | Description |
|---------|-------------|
| `dotenc tools install-agent-skill [--force]` | Install this agent skill via `npx skills add` |
| `dotenc tools install-vscode-extension` | Add editor recommendation / open extension URLs |
| `dotenc update` | Update CLI based on detected install method |
| `dotenc textconv <filepath>` | Hidden: decrypt file for git diff |

## Safety rules

- Never print decrypted secret values in chat output.
- Prefer `dotenc env edit`, `dotenc dev`, and `dotenc run` over raw decrypt output.
- Pass explicit command arguments to avoid interactive prompts when automating.
- Ask for confirmation before running destructive operations (`dotenc key remove`, `dotenc auth revoke`, `dotenc env rotate`).
- Keep `.env.*.enc` files committed to Git; they are encrypted and intended for version control.

## Troubleshooting cues

- If commands fail with project-not-initialized errors, run `dotenc init --name <username>`.
- If `dotenc run` reports no environment, pass `-e <environment>` or set `DOTENC_ENV`.
- If update notifications should be disabled in CI/noisy environments, set `DOTENC_SKIP_UPDATE_CHECK=1`.
- If identity cannot be resolved for `dotenc dev`, run `dotenc whoami` and ensure your key exists in `.dotenc/`.
- If key import fails due to passphrase protection, use an unencrypted key or add a compatible public key file.

---
name: dotenc
description: Manage dotenc encrypted environments. Use when the user asks about environment variables, secrets, dotenc setup, encrypted environments, adding teammates, rotating keys, or running commands with secrets injected.
allowed-tools: Bash, Read, Glob, Grep
argument-hint: [command]
---

## Project context

> If any command below shows an error, dotenc is likely not initialized — suggest running `dotenc init` first.

**Current identity:**
!`dotenc whoami 2>&1 || true`

**Available environments:**
!`dotenc env list 2>&1 || true`

**Project public keys:**
!`dotenc key list 2>&1 || true`

## What is dotenc?

dotenc is a Git-native encrypted environment management tool powered by SSH keys. It encrypts environment variables using AES-256-GCM and manages per-user access control using existing SSH key infrastructure. Private keys never leave `~/.ssh/`; only public keys are stored in the `.dotenc/` project folder. Encrypted files are safe to commit to Git.

## Common workflows

**First-time setup**
```bash
dotenc init --name alice
dotenc key add alice --from-ssh ~/.ssh/id_ed25519
dotenc env create development alice
dotenc env edit development        # opens editor to add secrets
```

**Onboard a new teammate**
```bash
dotenc key add bob --from-ssh /path/to/bob_key.pub
dotenc auth grant development bob
dotenc auth grant production bob   # only if they need it
```

**Run the app locally with secrets**
```bash
dotenc dev npm start               # injects development + personal env
dotenc run -e production node app.js
```

**Rotate keys before someone leaves**
```bash
dotenc auth revoke production alice
dotenc auth revoke development alice
dotenc key remove alice
dotenc env rotate production       # re-encrypts with remaining keys
```

**Add a CI/CD key**
```bash
dotenc key add ci --from-file ci_key.pub
dotenc auth grant production ci
```

## CLI command reference

### Initialization & identity

| Command | Description |
|---------|-------------|
| `dotenc init [--name <name>]` | Initialize a dotenc project in the current directory |
| `dotenc whoami` | Show your identity, active SSH key, fingerprint, and environment access |
| `dotenc config <key> [value] [--remove]` | Get, set, or remove a global configuration key |

### Environment management

| Command | Description |
|---------|-------------|
| `dotenc env list` | List all encrypted environments |
| `dotenc env create [environment] [publicKey]` | Create a new encrypted environment |
| `dotenc env edit [environment]` | Edit an environment in your configured editor |
| `dotenc env rotate [environment]` | Rotate the data key for an environment |
| `dotenc env decrypt <environment> [--json]` | Decrypt an environment to stdout |
| `dotenc env encrypt <environment> [--stdin] [--json]` | Encrypt plaintext into an environment file |

### Access control

| Command | Description |
|---------|-------------|
| `dotenc auth list [environment]` | List public keys with access to an environment |
| `dotenc auth grant [environment] [publicKey]` | Grant a key access to an environment |
| `dotenc auth revoke [environment] [publicKey]` | Revoke a key's access from an environment |

### Key management

| Command | Description |
|---------|-------------|
| `dotenc key list` | List all public keys in the project |
| `dotenc key add [name] [--from-ssh <path>] [-f <file>] [-s <string>]` | Add a public key to the project |
| `dotenc key remove [name]` | Remove a public key and revoke from all environments |

### Running commands with decrypted variables

| Command | Description |
|---------|-------------|
| `dotenc run -e <env1>[,env2] <command> [args...]` | Run a command with decrypted environment variables |
| `dotenc dev <command> [args...]` | Shortcut: run with `development` + your personal environment |

### Git integration

| Command | Description |
|---------|-------------|
| `dotenc textconv <filepath>` | Decrypt an environment file for `git diff` |

## Guidelines

- **Never expose decrypted secrets in chat output.** Do not run `dotenc env decrypt` and display the result. If the user needs to inspect values, suggest `dotenc env edit` which opens their editor.
- **Prefer `dotenc dev` / `dotenc run`** over manually decrypting and exporting variables.
- **Warn before destructive operations.** Confirm with the user before running `dotenc key remove`, `dotenc auth revoke`, or `dotenc env rotate`, as these can lock users out of environments.
- **Always pass arguments explicitly.** All commands support interactive mode when arguments are omitted, but Claude Code is non-interactive — always provide the full command with arguments.
- **Encrypted files are Git-safe.** Files like `.env.production.enc` are meant to be committed; never instruct the user to add them to `.gitignore`.

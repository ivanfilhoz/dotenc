# ![dotenc](/assets/logo.jpg "dotenc logo")

[![NPM Version][npm-image]][npm-url]
[![Github License][license-image]](/LICENSE)
[![NPM Downloads][downloads-image]][npm-url]
[![Codecov][codecov-image]][codecov-url]

🔐 Git-native encrypted environments powered by your SSH keys

## 30-Second Example

```bash
dotenc init            # pick your SSH key, choose a name
dotenc env edit alice  # add your personal secrets
dotenc dev npm start   # run with your encrypted env
```

Encrypted `.env.alice.enc` committed.
No external services.
Uses your existing SSH keys.
Done.

## Features

- 🔒 Uses the battle-tested AES-256-GCM encryption algorithm
- 🔑 Uses your existing SSH keys - no extra key management
- 🚀 Secure command running with on-the-fly decryption
- ✍️ Easy and secure environment variable editing
- 🌍 Supports multiple and extensible environments
- 👤 Personal encrypted environments per developer
- 🔄 Automatic data key rotation on edits
- 🛡️ Supports both RSA and Ed25519 SSH keys

## Table of Contents

- [30-Second Example](#30-second-example)
- [Features](#features)
- [Why?](#why)
- [Security Model](#security-model)
- [How It Works](#how-it-works)
  - [Project Structure](#project-structure)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
  - [Setup](#setup)
  - [Creating a new environment](#creating-a-new-environment)
  - [Listing environments](#listing-environments)
  - [Editing an environment](#editing-an-environment)
  - [Run commands on an environment](#run-commands-on-an-environment)
  - [Checking your identity](#checking-your-identity)
- [Tooling and Maintenance](#tooling-and-maintenance)
  - [CLI updates](#cli-updates)
  - [Editor integration helpers](#editor-integration-helpers)
- [Team Collaboration](#team-collaboration)
  - [Granting access to a new team member](#granting-access-to-a-new-team-member)
  - [Revoking access from a team member](#revoking-access-from-a-team-member)
  - [Listing access](#listing-access)
- [Offboarding a Team Member](#offboarding-a-team-member)
- [CI/CD Integration](#cicd-integration)
  - [1. Generate a dedicated CI key](#1-generate-a-dedicated-ci-key)
  - [2. Add the key and grant access](#2-add-the-key-and-grant-access)
  - [3. Set the private key in your CI provider](#3-set-the-private-key-in-your-ci-provider)
  - [4. Use dotenc in your CI pipeline](#4-use-dotenc-in-your-ci-pipeline)
  - [GitHub Actions example](#github-actions-example)
- [Key Management](#key-management)
  - [Supported Key Types](#supported-key-types)
  - [Adding a public key](#adding-a-public-key)
  - [Listing public keys](#listing-public-keys)
  - [Removing a public key](#removing-a-public-key)
- [Tips](#tips)
- [How dotenc compares](#how-dotenc-compares)
- [When NOT to use dotenc](#when-not-to-use-dotenc)
- [License](#license)

## Why?

Managing secrets and environment variables is critical for any modern application, but most solutions rely on third-party services and web dashboards. **dotenc** was created to solve these problems:

- **No Vendor Lock-In:** Your secrets and keys live in your codebase and your repository. You're never tied to a third-party provider or forced to migrate if pricing or policies change.
- **Improved Security:** Eliminate the risk of exposing secrets to external services. All encryption and decryption happen locally, and private keys never leave your machine.
- **Zero Key Management:** You already have SSH keys. dotenc uses them directly - no custom key generation, no extra files cluttering your home directory, no new workflows to learn.
- **Better Developer Experience:** No more juggling environment variables in a web UI or struggling to keep them in sync across branches. Everything is managed alongside your code, with simple CLI commands and full Git integration.
- **Seamless Collaboration:** Onboard or revoke team members with a single command. Grant or remove access per environment, and let Git handle the rest.
- **Fully Auditable:** Every grant and revoke is tracked within your Git history, so you always know who had access and when changes were made.
- **PR-Safe Environment Changes:** Environment variable updates live in the same pull request as your feature code. No more "merge → broken build → patch env → rebuild" workflow.

## Security Model

- Each environment has its own randomly generated 256-bit data key.
- Data keys are encrypted per-user using their SSH public key.
- dotenc uses AES-256-GCM for authenticated encryption.
- Your repository alone is not enough to decrypt secrets.
- Access can be revoked at any time.

## How It Works

1. dotenc detects your existing SSH keys in `~/.ssh/` (Ed25519 or RSA);
2. Your public key is derived and stored in the project (`.dotenc/john.pub`);
3. A unique data key is generated for each environment;
4. The data key is encrypted with each authorized public key;
5. Environment variables are encrypted using the data key with AES-256-GCM;
6. Encrypted files (`.env.*.enc`) are committed to your repository;
7. When running commands, variables are decrypted on-the-fly using your SSH private key.

Your SSH private keys never leave `~/.ssh/`. dotenc reads them in place - nothing is copied, nothing is stored elsewhere.

### Project Structure

After setup, your project will look like:

```plaintext
.
├── .dotenc/
│   ├── alice.pub
│   ├── bob.pub
│   └── ...
├── .env.alice.enc
├── .env.production.enc
└── .env.development.enc
```

Encrypted files are committed to Git. Public keys are stored inside `.dotenc/`. Each developer gets a personal encrypted environment (e.g., `.env.alice.enc`).

## Installation

### Homebrew (macOS / Linux)

```bash
brew tap ivanfilhoz/dotenc
brew install dotenc
```

### Scoop (Windows)

```bash
scoop bucket add dotenc https://github.com/ivanfilhoz/scoop-dotenc
scoop install dotenc
```

### npm

```bash
npm install -g @dotenc/cli
```

### Standalone binary

Download the latest binary for your platform from the [GitHub Releases](https://github.com/ivanfilhoz/dotenc/releases) page.

## Basic Usage

### Setup

```bash
dotenc init
```

This will interactively guide you through the setup process:

1. Scanning your `~/.ssh/` directory for SSH keys (Ed25519, RSA, etc.);
2. Prompting for your username (defaults to your system username);
3. Letting you choose which SSH key to use;
4. Deriving the public key and storing it in `.dotenc/` (e.g., `.dotenc/alice.pub`);
5. Creating encrypted `development` and personal environments (e.g., `.env.development.enc`, `.env.alice.enc`).

No keys to generate. If you already have an SSH key (and you probably do), you're ready to go.

If you don't have an SSH key yet, just run `ssh-keygen` first - you'll want one anyway.

### Creating a new environment

```bash
dotenc env create [environment]
```

This command creates a new encrypted environment file under the specified name (e.g., `.env.development.enc`). Your personal environment is created automatically during `init`.
Environment names may contain letters, numbers, dots (`.`), hyphens (`-`), and underscores (`_`).

### Listing environments

```bash
dotenc env list
```

Lists all encrypted environments in the current project.

### Editing an environment

```bash
dotenc env edit [environment]
```

Opens your system's default editor to modify the specified environment. To set a custom editor, use the `dotenc config editor` command. It will take precedence over your system's default editor.

Example:

```bash
dotenc config editor vim
```

Currently supported `dotenc config` key: `editor`.
You can include editor arguments, for example: `dotenc config editor "code --wait"`.

### Run commands on an environment

For development, the `dev` command loads both the shared `development` environment and your personal environment automatically:

```bash
dotenc dev <command> [...args]
```

Example:

```bash
dotenc dev node app.js
```

For explicit environment control, use `run`:

```bash
dotenc run --env <environment> <command> [...args]
# or
dotenc run -e <environment> <command> [...args]
```

Example:

```bash
dotenc run -e production node app.js
```

You can also specify multiple environments:

```bash
dotenc run -e base,production node app.js
```

In the example above, `production` will override any variables also present in `base`.

If you want `run` to fail when any selected environment cannot be loaded, use strict mode:

```bash
dotenc run --strict -e base,production node app.js
```

### Checking your identity

```bash
dotenc whoami
```

Shows your name, active SSH key, fingerprint, and the environments you have access to in this project.

## Tooling and Maintenance

### CLI updates

```bash
dotenc update
```

Runs the appropriate update flow for your installation method (Homebrew, Scoop, npm, or manual binary instructions).

### Editor integration helpers

```bash
dotenc tools install-vscode-extension
dotenc tools install-agent-skill
dotenc tools install-agent-skill --force
```

- `install-vscode-extension` adds extension recommendations for supported editors and can open the extension page.
- `install-agent-skill` installs the dotenc agent skill through `npx skills add`.
- `--force` maps to non-interactive mode (`-y`) for automation.

## Team Collaboration

In a real-world scenario, you will likely have multiple environments (e.g., `development`, `test`, `production`) and a team of developers who need access to these environments. Let's walk through how to set this up.

### Granting access to a new team member

Alice just joined your team and she needs access to the shared environments, except `production`. She already has an SSH key (because of course she does - she's a developer).

She sends you her public key (`~/.ssh/id_ed25519.pub`) — it's a public key, so Slack, email, or even a sticky note will do — and you grant her access:

```bash
git checkout -b grant-alice-key
dotenc key add alice --from-file alice.pub
dotenc auth grant development alice
dotenc auth grant test alice
git add .
git commit -m "Grant alice access to development and test environments"
git push
```

Now, Alice will be able to decrypt the `development` and `test` environments using her SSH key. No new tools for her to install, no custom keys to generate - just her existing SSH key.

### Revoking access from a team member

One of your team members, John, is leaving the company. You need to revoke his access to all environments. To do this, you can run:

```bash
dotenc key remove john
```

This will delete his key from the repository and attempt to revoke and re-encrypt every affected environment. If one environment cannot be decrypted on your machine, dotenc will warn you so you can revoke access manually or rotate that environment. Then, commit your changes:

```bash
git checkout -b revoke-john-key
git add .
git commit -m "Revoke John's access to all environments"
git push origin revoke-john-key
```

Once merged, he will no longer be able to decrypt any environments.

### Listing access

```bash
dotenc auth list [environment]
```

Lists all public keys that have access to the specified environment.

## Offboarding a Team Member

Revoking repository decryption does not undo previously granted access to already-seen secrets.
For proper offboarding, we recommend:

1. `dotenc key remove <user>`
2. Rotate external secrets (database passwords, API tokens, etc.)
3. (Optional) `dotenc env rotate <environment>` to rotate the environment data key
4. Deploy updated configuration

## CI/CD Integration

CI runners and build servers need their own identity to decrypt environments. The approach is the same as local development: generate a key, grant access, and provide the private key at runtime.

### 1. Generate a dedicated CI key

Create an Ed25519 key pair for your CI environment. Do **not** set a passphrase:

```bash
ssh-keygen -t ed25519 -f ci_key -N "" -C "ci"
```

This produces two files: `ci_key` (private) and `ci_key.pub` (public).

### 2. Add the key and grant access

Register the public key in the project and grant it access to the environments CI needs:

```bash
dotenc key add ci --from-ssh ./ci_key
dotenc auth grant test ci
dotenc auth grant production ci
git add .
git commit -m "Add CI key and grant access to test and production"
git push
```

### 3. Set the private key in your CI provider

Copy the **entire** contents of the private key file and store it as a secret environment variable named `DOTENC_PRIVATE_KEY` in your CI provider (GitHub Actions, GitLab CI, CircleCI, etc.):

```bash
cat ci_key
```

```plaintext
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbm...
-----END OPENSSH PRIVATE KEY-----
```

Paste the full output — including the `BEGIN` and `END` lines — as the value of `DOTENC_PRIVATE_KEY`.

Once stored, delete the local private key file:

```bash
rm ci_key
```

The public key (`ci_key.pub`) can also be deleted — it's already tracked inside `.dotenc/ci.pub`.

### 4. Use dotenc in your CI pipeline

With `DOTENC_PRIVATE_KEY` set, dotenc will automatically pick up the key. No `~/.ssh` directory required:

```bash
dotenc run -e test npm test
dotenc run -e production node app.js
```

### GitHub Actions example

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: npm ci
      - run: npm install -g @dotenc/cli
      - run: dotenc run -e test npm test
        env:
          DOTENC_PRIVATE_KEY: ${{ secrets.DOTENC_PRIVATE_KEY }}
```

## Key Management

dotenc keeps key management minimal by design. Your SSH keys are your identity - dotenc just uses them.

> **Private keys** stay in `~/.ssh/` where they belong. They are never copied or moved.
> **Public keys** are stored in your project's `.dotenc/` folder, derived from the corresponding private keys.

## Supported Key Types

dotenc supports the following SSH key types:

- Ed25519
- RSA (2048-bit or larger)

These types are widely supported and provide strong security guarantees.

> **Note:** Passphrase-protected SSH keys are not currently supported. dotenc needs to read your private key directly, and it cannot prompt for or decrypt passphrases. If all your keys are passphrase-protected, you can generate a dedicated key without a passphrase:
>
> ```bash
> ssh-keygen -t ed25519 -N ""
> ```

### Adding a public key

```bash
dotenc key add [name] [--from-ssh <path>] [-f, --from-file <file>] [-s, --from-string <pem_string>]
```

Adds a public key into the project (`.dotenc/<name>.pub`).

- `--from-ssh <path>` — Derive the public key from an SSH key file (private or public). Supports both Ed25519 and RSA keys.
- `-f, --from-file <file>` — Read a public (or private) key from a PEM file.
- `-s, --from-string <pem_string>` — Use a PEM string directly.
- No arguments — Interactive mode: choose from your SSH keys or paste a PEM public key.
- Key names may contain letters, numbers, dots (`.`), hyphens (`-`), and underscores (`_`).

### Listing public keys

```bash
dotenc key list
```

Lists all public keys in the project, showing each key's name and algorithm.

### Removing a public key

```bash
dotenc key remove [name]
```

Removes a public key from the project, attempting to revoke it from every environment.

## Tips

For convenience, you can setup your `package.json` file like this:

```jsonc
  // ...
  "scripts": {
    "dev": "dotenc dev tsx src/app.ts",
    "start": "dotenc run -e production node dist/app.js",
    "test": "dotenc run -e test vitest"
  }
```

Alternatively, the `DOTENC_ENV` variable can be used to set the environment, so the `-e` option can be omitted. For example:

```bash
  export DOTENC_ENV="production"
  dotenc run node app.js
```

### Update checks

The CLI checks for new versions in the background (at most once every 6 hours) and prints a notification when an update is available.

To disable these checks:

```bash
export DOTENC_SKIP_UPDATE_CHECK=1
```


## How dotenc compares

 dotenc is a Git-native encryption layer designed for teams who want encrypted environment files committed alongside their code.
It does not aim to replace centralized secret managers like Vault or Doppler — it serves a different operational model.

| Capability | dotenc | SOPS (+ age) | Vault | Doppler |
|-------------|---------|--------------|--------|----------|
| Git-native encrypted files | ✅ | ✅ | ❌ | ❌ |
| Uses existing SSH identity | ✅ | ❌ (age / PGP) | ❌ | ❌ |
| No external service required | ✅ | ✅ | ❌ | ❌ |
| Environments versioned with code | ✅ | ✅ | ❌ | ❌ |
| Centralized runtime secret API | ❌ | ❌ | ✅ | ✅ |
| Dynamic / short-lived secrets | ❌ | ❌ | ✅ | ❌ |
| Built-in org policy engine | ❌ | ❌ | ✅ | ✅ |
| Requires running infrastructure | ❌ | ❌ | ✅ | ❌ |

## When NOT to use dotenc

- If you require centralized policy enforcement
- If your compliance mandates HSM-backed key storage
- If you need runtime secret injection via remote API

## License

[MIT](https://github.com/ivanfilhoz/dotenc/blob/main/LICENSE)

[npm-image]: https://img.shields.io/npm/v/@dotenc/cli.svg
[license-image]: https://img.shields.io/github/license/ivanfilhoz/dotenc.svg
[downloads-image]: https://img.shields.io/npm/dm/@dotenc/cli.svg
[npm-url]: https://npmjs.org/package/@dotenc/cli
[codecov-image]: https://codecov.io/gh/ivanfilhoz/dotenc/graph/badge.svg?token=U2MKXVGBA0
[codecov-url]: https://codecov.io/gh/ivanfilhoz/dotenc

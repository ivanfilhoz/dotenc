# ![dotenc](/assets/logo.png "dotenc logo")

[![NPM Version][npm-image]][npm-url]
[![Github License][license-image]](LICENSE)
[![NPM Downloads][downloads-image]][npm-url]

🔐 Git-native encrypted environments powered by your SSH keys

## 30-Second Example

```bash
dotenc init
dotenc create production
dotenc edit production
dotenc run -e production node app.js
```

Encrypted `.env.production.enc` committed.
No external services.
Uses your existing SSH keys.
Done.

## Features

- 🔒 Uses the battle-tested AES-256-GCM encryption algorithm
- 🔑 Uses your existing SSH keys - no extra key management
- 🚀 Secure command running with on-the-fly decryption
- ✍️ Easy and secure environment variable editing
- 🌍 Supports multiple and extensible environments
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
  - [Editing an environment](#editing-an-environment)
  - [Run commands on an environment](#run-commands-on-an-environment)
- [Deploying your Application](#deploying-your-application)
- [Team Collaboration](#team-collaboration)
  - [Granting access to a new team member](#granting-access-to-a-new-team-member)
  - [Revoking access from a team member](#revoking-access-from-a-team-member)
- [Offboarding a Team Member](#offboarding-a-team-member)
- [Key Management](#key-management)
  - [Adding a public key](#adding-a-public-key)
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

```
.
├── .dotenc/
│   ├── alice.pub
│   ├── bob.pub
│   └── ...
├── .env.production.enc
├── .env.development.enc
└── dotenc.json
```

Encrypted files are committed to Git. Public keys are stored inside `.dotenc/`.

## Installation

```bash
npm install -g @dotenc/cli
```

## Basic Usage

### Setup

```bash
dotenc init
```

This will interactively guide you through the setup process:

1. Scanning your `~/.ssh/` directory for SSH keys (Ed25519, RSA, etc.);
2. Letting you choose which SSH key(s) to use;
3. Deriving the public key and storing it in `.dotenc/` (e.g., `.dotenc/john.pub`);
4. Creating a `dotenc.json` configuration file in the root of your project.

No keys to generate. If you already have an SSH key (and you probably do), you're ready to go.

If you don't have an SSH key yet, just run `ssh-keygen` first - you'll want one anyway.

### Creating a new environment

```bash
dotenc create [environment]
```

This command creates a new encrypted environment file under the specified name (e.g., `.env.development.enc`).

### Editing an environment

```bash
dotenc edit [environment]
```

Opens your system's default editor to modify the specified environment. To set a custom editor, use the `dotenc config editor` command. It will take precedence over your system's default editor.

Example:

```bash
dotenc config editor vim
```

### Run commands on an environment

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

## Deploying your Application

Every machine needs an authorized private key to decrypt the environment variables. For CI/CD and hosting providers, the recommended approach is to use the `DOTENC_PRIVATE_KEY` environment variable.

For example, if you're deploying to Netlify, generate an Ed25519 key pair for it:

```bash
ssh-keygen -t ed25519 -f netlify_key -N ""
```

Then add the public key to the project and grant access:

```bash
dotenc key add netlify --from-ssh ./netlify_key
dotenc grant production netlify
```

Now, copy the contents of the private key and paste it into your Netlify environment variables:

```bash
DOTENC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
```

And configure Netlify to run your application using the `dotenc` command:

```bash
dotenc run -e production node app.js
```

Then, commit the changes:

```bash
git add .
git commit -m "Add Netlify's public key and grant access to production environment"
git push
```

That's it! The private key stays in Netlify's environment variables, and the public key lives in your repository. Clean separation.

## Team Collaboration

In a real-world scenario, you will likely have multiple environments (e.g., `development`, `test`, `production`) and a team of developers who need access to these environments. Let's walk through how to set this up.

### Granting access to a new team member

Alice just joined your team and she needs access to the shared environments, except `production`. She already has an SSH key (because of course she does - she's a developer).

She sends you her public key (`~/.ssh/id_ed25519.pub`) — it's a public key, so Slack, email, or even a sticky note will do — and you grant her access:

```bash
git checkout -b grant-alice-key
dotenc key add alice --from-file alice.pub
dotenc grant development alice
dotenc grant test alice
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

This will delete his key from the repository and automatically reencrypt all the environments. Then, commit your changes:

```bash
git checkout -b revoke-john-key
git add .
git commit -m "Revoke John's access to all environments"
git push origin revoke-john-key
```

Once merged, he will no longer be able to decrypt any environments.

## Offboarding a Team Member

Revoking repository decryption does not undo previously granted access to already-seen secrets.
For proper offboarding, we recommend:

1. `dotenc key remove <user>`
2. Rotate external secrets (database passwords, API tokens, etc.)
3. (Optional) `dotenc rotate <environment>` to rotate the environment data key
4. Deploy updated configuration

## Key Management

dotenc keeps key management minimal by design. Your SSH keys are your identity - dotenc just uses them.

> **Private keys** stay in `~/.ssh/` where they belong. They are never copied or moved.
> **Public keys** are stored in your project's `.dotenc/` folder, derived from the corresponding private keys.

## Supported Key Types

dotenc supports the following SSH key types:

- Ed25519
- RSA (2048-bit or larger)

These types are widely supported and provide strong security guarantees.

### Adding a public key

```bash
dotenc key add [name] [--from-ssh <path>] [--from-file <file>] [--from-string <pem_string>]
```

Adds a public key into the project (`.dotenc/<name>.pub`).

- `--from-ssh <path>` — Derive the public key from an SSH key file (private or public). Supports both Ed25519 and RSA keys.
- `--from-file <file>` — Read a public (or private) key from a PEM file.
- `--from-string <pem_string>` — Use a PEM string directly.
- No arguments — Interactive mode: choose from your SSH keys or paste a PEM public key.

### Removing a public key

```bash
dotenc key remove [name]
```

Removes a public key from the project, automatically revoking it from every environment.

## Tips

For convenience, you can setup your `package.json` file like this:

```jsonc
  // ...
  "scripts": {
    "dev": "dotenc run -e development tsx src/app.ts",
    "start": "dotenc run -e production node dist/app.js",
    "test": "dotenc run -e test vitest"
  }
```

Alternatively, the `DOTENC_ENV` variable can be used to set the environment, so the `-e` option can be omitted. For example:

```bash
  export DOTENC_ENV="production"
  dotenc run node app.js
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

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/@dotenc/cli.svg
[license-image]: https://img.shields.io/github/license/ivanfilhoz/dotenc.svg
[downloads-image]: https://img.shields.io/npm/dm/@dotenc/cli.svg
[npm-url]: https://npmjs.org/package/@dotenc/cli

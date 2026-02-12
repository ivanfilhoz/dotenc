# ![dotenc](/assets/logo.png "dotenc logo")

[![NPM Version][npm-image]][npm-url]
[![Github License][license-image]](LICENSE)
[![NPM Downloads][downloads-image]][npm-url]

🔐 Secure, encrypted environment variables that live in your codebase

## Features

- 🔒 Uses the battle-tested AES-256-GCM encryption algorithm
- 🔑 You own your keys - no vendor lock-in
- 🚀 Secure command running with on-the-fly decryption
- ✍️ Easy and secure environment variable editing
- 🌍 Supports multiple and extensible environments
- 🔄 Self-healing, built-in ephemeral data keys

## Table of Contents

- [Why?](#why)
- [How It Works](#how-it-works)
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
- [Advanced Key Management](#advanced-key-management)
  - [Generating a new private key](#generating-a-new-private-key)
  - [Sharing your public key](#sharing-your-public-key)
  - [Adding a public key](#adding-a-public-key)
  - [Removing a public key](#removing-a-public-key)
  - [Importing a private key](#importing-a-private-key)
  - [Exporting a key pair](#exporting-a-key-pair)
- [Tips](#tips)
- [License](#license)

## Why?

Managing secrets and environment variables is critical for any modern application, but most solutions rely on third-party services and web dashboards. **dotenc** was created to solve these problems:

- **No Vendor Lock-In:** Your secrets and keys live in your codebase and your repository. You’re never tied to a third-party provider or forced to migrate if pricing or policies change.
- **Improved Security:** Eliminate the risk of exposing secrets to external services. All encryption and decryption happen locally, and private keys never leave your machine.
- **Better Developer Experience:** No more juggling environment variables in a web UI or struggling to keep them in sync across branches. Everything is managed alongside your code, with simple CLI commands and full Git integration.
- **Seamless Collaboration:** Onboard or revoke team members with a single command. Grant or remove access per environment, and let Git handle the rest.
- **Fully Auditable:** Every grant and revoke is tracked within your Git history, so you always know who had access and when changes were made.

With **dotenc**, you get a workflow that’s secure, portable, auditable, and designed for how developers actually work.

## How It Works

1. An RSA-2048 key pair is generated for your machine;
2. The private key is stored securely in your home folder (`~/.dotenc/bob.pem`);
3. The public key is added into the project root folder (`.dotenc/bob.pub`);
4. A secure data key is generated for each environment using the public key;
5. Environment variables are encrypted using the data key;
6. Encrypted files (`.env.*.enc`) are committed to your repository;
7. When running commands, variables are decrypted on-the-fly.

## Installation

```bash
npm install -g @dotenc/cli
```

## Basic Usage

### Setup

```bash
dotenc init
```

This will interactively guide you through the setup process, which includes:

1. Generating a new private key for your machine (e.g., `bob.pem`);
2. Importing the public key into the `.dotenc` directory (e.g., `.dotenc/bob.pub`);
3. Creating a `dotenc.json` configuration file in the root of your project.

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

Every machine needs an authorized private key to decrypt the environment variables. If you need to deploy your application to a hosting provider, the recommended approach is to create a new key pair specifically for it. For example, if you're deploying to Netlify, you can run:

```bash
dotenc key generate netlify               # generates a new key pair
dotenc key add --from-private-key netlify # adds the public key to the .dotenc directory
dotenc create production                  # creates a new environment file
dotenc grant production netlify           # grants access to the production environment
```

Now, export your newly created private key:

```bash
dotenc key export netlify
```

Copy the output and paste it into your Netlify environment variables like this:

```bash
DOTENC_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
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

That's it!

## Team Collaboration

In a real-world scenario, you will likely have multiple environments (e.g., `development`, `test`, `production`) and a team of developers who need access to these environments. Let's walk through how to set this up.

### Granting access to a new team member

Alice just joined your team and she needs access to the shared environments, except `production`. For that, she must run:

```bash
npm i -g @dotenc/cli
dotenc key generate alice
dotenc key share alice
```

Then, she must send you through a secure channel, and you can grant her access to each environment by running:

```bash
git checkout -b grant-alice-key
dotenc add alice --from-share "<paste her shared key here>"
dotenc grant development alice
dotenc grant test alice
git add .
git commit -m "Grant alice access to development and test environments"
git push
```

Now, Alice will be able to decrypt the `development` and `test` environments.

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

## Advanced Key Management

>Note: Private keys are always stored in your home directory (`~/.dotenc/`). Public keys are stored in your project’s `.dotenc/` folder.

To manage your keys, you can use the following commands:

### Generating a new private key

```bash
dotenc key generate [name]
```

Generates a new RSA private key. If a name is not provided, it will prompt you for one. The default name is your OS username, but you can specify any name you like, like your GitHub username or your email address.

### Sharing your public key

```bash
dotenc key share [name]
```

Generates a shareable public key from the specified private key. This is useful for sharing your public key with others so they can grant you access using `dotenc add --from-share`.

### Adding a public key

```bash
dotenc key add [name] [--from-private-key <private_key_name>] [--from-share <share_string>] [--from-string <pem_string>] [--from-file <file_path>]
```

Adds a public key into the project (`.dotenc/<name>.pub`).

If `--from-private-key` is provided, it will use the specified private key to generate the public key. If `--from-share` is provided, it will parse the shareable public key string. If `--from-string` is provided, it will use the provided PEM string as the public key. If `--from-file` is provided, it will be generated from the private or public key in the provided path. If no parameters are provided, it will prompt you to either choose an existing private key or paste a public key.

If you are adding a public key from one of your existing private keys (by providing a `private_key_name`), dotenc will attempt to add the public key with the same name as the private key. If a public key with the same name already exists, it will prompt you for a new one.

### Removing a public key

```bash
dotenc key remove [name]
```

Removes a public key from the project, automatically revoking it from every environment.

### Importing a private key

```bash
dotenc key import [name] [--from-string <pem_string>] [--from-file <file_path>]
```

Imports a private key from a file and stores it in your home directory (`~/.dotenc/<name>.pem`). The file path is optional; if not provided, it will prompt you to paste the private key content.

The key must be in PEM format, which looks like this:

```plaintext
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

### Exporting a key pair

```bash
dotenc key export [name] [--public]
```

Prints a private key to the console. You can redirect the output to a file if needed. If the `--public` flag is provided, it will generate a public key from the private key and print it instead.

#### ⚠ Important

Be careful with the private key! It should never be shared publicly or stored in your repository. Only use this command for CI/CD or a second workstation, for example.

To grant someone access to an environment, ask them to [share their public key with you instead](#sharing-your-public-key).

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

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/@dotenc/cli.svg
[license-image]: https://img.shields.io/github/license/ivanfilhoz/dotenc.svg
[downloads-image]: https://img.shields.io/npm/dm/@dotenc/cli.svg
[npm-url]: https://npmjs.org/package/@dotenc/cli

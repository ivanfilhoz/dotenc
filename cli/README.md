# ![dotenc](./assets/logo.png "dotenc logo")
🔐 Secure, encrypted environment variables that live in your codebase

## Features

- 🔒 Uses the battle-tested AES-256-GCM encryption algorithm
- 🔑 Keys can be exported anytime - no vendor lock-in
- 🚀 Secure command running with on-the-fly decryption
- ✍️ Easy and secure environment variable editing
- 🌍 Supports multiple and extensible environments
- 🔄 Offers a simplified key rotation process

## How It Works

1. Environment variables are encrypted using a secure key
2. Encrypted files (`.env.*.enc`) are committed to your repository
3. Keys are stored securely and not committed to the repository
4. The local, git-ignored `.env` file can be used for development
5. When running commands, variables are decrypted on-the-fly

## Installation

```bash
npm install -g @dotenc/cli
```

## Usage

### Initialize a New Environment

```bash
dotenc init [environment]
```

This will:
1. Create a new encrypted environment file (`.env.[environment].enc`)
2. Set up a local `.env` file for development
3. Create a `dotenc.json` configuration file

### Edit an Environment

```bash
dotenc edit [environment]
```

Opens your system's default editor to modify the specified environment. To set a custom editor, use the `dotenc config editor` command. It will take precedence over your system's default editor.

Example:
```bash
dotenc config editor vim
```

### Run Commands on an Environment

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

In the example above, `production` will override any variables also present in `global`.

### Key management

To import a key into your machine, use the `key import` command:
```bash
dotenc key import <environment> <key>
```

To export a key from your machine, use the `key export` command:
```bash
dotenc key export <environment>
```

To rotate a key, use the `key rotate` command:
```bash
dotenc key rotate <environment>
```

## Use Cases

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

Also, if a key is not present in your machine, you can use the `DOTENC_KEY` variable to decrypt an environment:

```bash
  DOTENC_KEY=<prod_key> dotenc run -e production node app.js
```

This can be useful for CI and automated platforms like Netlify and Vercel. Just export your keys and set the `DOTENC_KEY` variable in each environment.

The `DOTENC_KEY` variable also works with multiple environments:

```bash
  DOTENC_KEY=<base_key>,<prod_key> dotenc run -e base,production node app.js
```

## License

MIT 
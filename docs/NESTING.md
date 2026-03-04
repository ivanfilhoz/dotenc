# Hierarchical Nesting — Implementation Reference

## Status

Implemented (Phase 1 in v0.8.0, Phase 2 in v0.9.0, simplified in v0.9.x).

## Objective

Enable consistent dotenc usage in monorepos and subfolders with:
- Project discovery through `.dotenc` via ancestor lookup.
- Hierarchical environments per folder.
- Recursive merge by default in `dotenc run` with last-in wins.
- `--local-only` in `dotenc run` to restrict merge to the current directory.

## Terminology

- `invocationDir`: current execution directory (`process.cwd()`).
- `projectRoot`: first ancestor (including `invocationDir`) that contains `.dotenc`.
- `local scope`: only `invocationDir`.

## Implemented Behavior

### Root resolution

1. Resolve `invocationDir` as a canonical path.
2. Traverse parent directories up to `/`.
3. The first directory containing `.dotenc` is `projectRoot`.
4. If none is found, fail with project-not-initialized error.
5. All key operations use this `projectRoot`.

---

### `dotenc run` / `dotenc dev`

- Accepts `-e env1,env2,...` or `DOTENC_ENV`.
- Default: loads `.env.<name>.enc` at every level from `projectRoot` down to `invocationDir`, merging in order (deeper overrides higher; rightmost `-e` env overrides earlier ones).
- `--local-only`: loads only from `invocationDir`, skipping all ancestor levels.

---

### `dotenc key add|list|remove`

- Always resolves `projectRoot` via ancestor lookup.
- Always reads/writes at `<projectRoot>/.dotenc`.
- `key remove`: removes the `.pub` file only — no automatic revoke or rotate. Users should run `dotenc auth purge <name>` for full offboarding.

---

### `dotenc auth grant|revoke|purge`

- Always resolves `projectRoot` via ancestor lookup.
- `auth purge <publicKey>`: discovers all `.env.*.enc` files recursively under `projectRoot`, revokes the key and rotates the data key for every environment that contains it, then removes the key from `.dotenc`. Requires confirmation (`--yes` to skip).

---

### `dotenc env list`

- **Default (no flags)**: lists environments in `invocationDir` only — flat names, no folder labels.
- **`--all`**: recursively discovers all `.env.*.enc` files from `projectRoot` downward; displays as `name  (relPath)` where `relPath` is relative to `projectRoot`.
- **`--json`**: outputs `{ "environments": [{ "name", "dir", "filePath" }, ...] }` for either mode. Empty results produce `{ "environments": [] }`.

---

### `dotenc env create`

- Always creates the environment file in `invocationDir`.
- To create an environment in a specific directory, `cd` to that directory first.
- Resolves `.dotenc/` via ancestor lookup for key access.

---

### `dotenc env edit`

- Operates on the `.env.<name>.enc` file in `invocationDir` directly. No ancestor search.
- To edit a nested environment, `cd` to its directory first.
- Resolves `.dotenc/` via ancestor lookup (for key access during re-encryption).

---

### `dotenc env encrypt` / `dotenc env decrypt`

- Operate on the `.env.<name>.enc` file in `invocationDir`.
- `.dotenc/` is resolved via ancestor lookup, so both commands work correctly from any subdirectory.

---

### `dotenc env rotate` / `dotenc env delete`

- Operate on the `.env.<name>.enc` file in `invocationDir` directly. No ancestor search.
- To target a nested environment, `cd` to its directory first.
- Require confirmation for destructive operations; `--yes` to skip.

---

### `dotenc env rotate --all`

- Recursively discovers all `.env.*.enc` files from `projectRoot` and rotates their data keys.
- Prints a per-file success/failure summary. Requires confirmation; `--yes` to skip.

---

## Key helpers

| Helper | Purpose |
|--------|---------|
| `resolveProjectRoot(dir, existsSync)` | Walks ancestors to find `.dotenc/` |
| `buildAncestorChain(root, leaf)` | Returns `[root, …intermediates, leaf]` — used by `run`/`dev` |
| `findEnvironmentsRecursive(rootDir)` | DFS scan for `.env.*.enc` files, skipping `node_modules`, `.git`, `dist`, etc. |

## Design principles

- **`cd` first**: `edit`, `encrypt`, and `decrypt` do not search ancestor directories for `.enc` files. The developer navigates to the target directory before running the command.
- **`.dotenc/` always resolved upward**: every command that needs public keys walks up to find the project root — no command requires being at the root.
- **`cd` first for writes**: `create`, `rotate`, and `delete` always operate on `invocationDir`. Navigate to the target directory before running the command. No flags or interactive prompts for path disambiguation.
- **`env list` is local by default**: discovering all environments across a large monorepo is an opt-in action (`--all`), keeping the common case fast and noise-free.

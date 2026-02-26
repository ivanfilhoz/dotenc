# Bun crypto repro: encrypted RSA error path poisons later Ed25519 key parsing

## Summary

We found a Bun runtime bug (observed on **Bun 1.3.9**) that affects `dotenc` key loading.

After a failed `crypto.createPrivateKey()` call on a **legacy encrypted RSA PEM** key (the `-----BEGIN RSA PRIVATE KEY-----` format with `Proc-Type: 4,ENCRYPTED`), Bun can no longer parse a valid **OpenSSH Ed25519 private key** in the same process when the parser eventually calls `crypto.createPrivateKey({ key: <PKCS#8 DER>, format: "der", type: "pkcs8" })`.

The exact same OpenSSH Ed25519 key parses successfully before the encrypted RSA error path, then fails after it.

## Why this matters to `dotenc`

`dotenc` scans `~/.ssh` and tries multiple keys.

- It first attempts `crypto.createPrivateKey(keyContent)`.
- For OpenSSH keys that Node/Bun do not parse natively, it falls back to a custom OpenSSH parser that reconstructs a PKCS#8 Ed25519 DER key and calls `crypto.createPrivateKey(...)`.

If `~/.ssh` contains a legacy **passphrase-protected RSA PEM** key, that failing `createPrivateKey()` call can poison later Ed25519 imports in the same process. This caused flaky/empty key lists in `getPrivateKeys()` and was the underlying reason a `decryptEnvironment()` double-call path broke. `dotenc` currently works around the issue by memoizing `getPrivateKeys()` inside one command invocation.

## Minimal standalone repro script

Use:

- `/Users/ivanfilho/Projetos/dotenc/docs/bun-crypto-encrypted-rsa-poisons-ed25519/repro-bun-encrypted-rsa-poisons-ed25519.ts`

Run:

```bash
bun /Users/ivanfilho/Projetos/dotenc/docs/bun-crypto-encrypted-rsa-poisons-ed25519/repro-bun-encrypted-rsa-poisons-ed25519.ts
```

What the script does:

1. Generates an unencrypted OpenSSH Ed25519 key via `ssh-keygen`.
2. Generates a legacy encrypted RSA PEM key via `ssh-keygen -m PEM -N pass123`.
3. Parses the Ed25519 key (success expected).
4. Calls `crypto.createPrivateKey()` on the encrypted RSA PEM (throws `Passphrase required...`, expected).
5. Parses the same Ed25519 key again.

Expected behavior:

- Step 5 should still succeed.

Actual behavior on Bun 1.3.9:

- Step 5 fails, reproducing the bug.

The script exits with code `1` when the bug is reproduced, and `0` when it is not.

## Strong signal (reduced sequence)

The bug can be reproduced with this sequence in a single Bun process:

1. Parse OpenSSH Ed25519 key (custom parser -> `crypto.createPrivateKey(PKCS#8 DER)`): succeeds.
2. `crypto.createPrivateKey(encrypted legacy RSA PEM)`: throws (expected passphrase error).
3. Parse the same OpenSSH Ed25519 key again: fails (unexpected).

This strongly suggests Bun state corruption or incorrect cleanup on the encrypted-PEM error path.

## Notes from investigation

- Repeated OpenSSH Ed25519 parsing alone is stable.
- Multiple unencrypted OpenSSH Ed25519 keys alone are stable.
- A generated passphrase-protected OpenSSH key did **not** trigger the issue in our tests.
- A legacy encrypted RSA PEM key **did** trigger the issue when combined with unencrypted OpenSSH Ed25519 parsing.
- In `dotenc`, this manifested as `getPrivateKeys()` returning different results across repeated calls in the same process.

## Prompt for a separate session on Bun's codebase

Use the repro script above as the test case. Please investigate Bun's `crypto.createPrivateKey()` implementation and error handling for encrypted PEM keys.

### Goal

Fix Bun so a failed `crypto.createPrivateKey()` call on an encrypted legacy RSA PEM does **not** affect subsequent private key parsing/imports in the same process.

### What to inspect

- The `crypto.createPrivateKey()` path for PEM inputs that require a passphrase (`BEGIN RSA PRIVATE KEY` + `Proc-Type: 4,ENCRYPTED`).
- Cleanup/error handling after the passphrase-required failure path.
- Any global/shared parser/OpenSSL state that may remain mutated after the error.
- Whether the OpenSSL error queue (or equivalent runtime state) is left uncleared and later interferes with DER PKCS#8 Ed25519 imports.
- Ed25519 PKCS#8 DER import path (`format: "der", type: "pkcs8"`) after a prior encrypted-PEM failure.

### Acceptance criteria

- The repro script exits `0`.
- The same Ed25519 key parses successfully before and after the encrypted-RSA `createPrivateKey()` failure.
- No regression for normal encrypted-PEM passphrase error behavior (it should still throw the correct error).

## dotenc workaround already in place

`dotenc` added a workaround in `decryptEnvironment()` to avoid calling `getPrivateKeys()` twice in one command execution (memoized result reuse). This prevents the user-visible failure but does not fix the Bun runtime bug.

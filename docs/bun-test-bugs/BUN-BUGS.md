# Bun bugs affecting dotenc

Two Bun runtime bugs were found and documented during dotenc development. Repro files live in the subfolders alongside this document.

---

## Bug 1: `mock.module` leaks across test files

**Status: Fixed** in `cli/custom-bun/bun` (custom Bun 1.3.10 build).

### Summary

`mock.module()` in one test file permanently replaces the module in the shared module registry for the lifetime of the `bun test` process. Subsequent test files that import the same module receive the mocked version instead of the real one. Calling `mock.restore()` in `afterAll()` does **not** prevent the leak.

Observed on Bun 1.3.9 and Bun 1.3.11-debug (current `oven-sh/bun` main before fix).

### Why it matters to dotenc

`dotenc` has command tests that use `mock.module()` to replace helpers (e.g. `validateKeyName`, `resolveProjectRoot`, `node:fs/promises`) and helper tests that exercise those same modules with their real implementations. When both groups ran in the same `bun test` invocation, helper tests received mocked exports and failed in ways impossible to reproduce in isolation.

### Repro

```bash
cd docs/bun-test-bugs/bun-mock-module-leaks-across-files

# File B alone — passes
bun test repro-b-real.test.ts

# Both files — repro-b-real.test.ts fails (mock leaks from A into B)
bun test repro-a-mock.test.ts repro-b-real.test.ts
```

Repro files: `bun-mock-module-leaks-across-files/`

### Fix

The module registry was not reset between test files in the same worker process. The fix scopes `mock.module()` replacements to the test file that called them, restoring the registry before each new test file executes.

The fix was cherry-picked onto Bun 1.3.10 stable and compiled as `cli/custom-bun/bun`. The `test` and `test:coverage` scripts in `cli/package.json` use this binary.

To verify the fix:

```bash
cd docs/bun-test-bugs/bun-mock-module-leaks-across-files
../../../cli/custom-bun/bun test repro-a-mock.test.ts repro-b-real.test.ts
# Expected: 2 pass, 0 fail
```

The full dotenc test suite now passes in a single invocation:

```
376 pass, 0 fail — Ran 376 tests across 60 files.
```

### Reproducing the custom build

```bash
cd ~/Projetos/bun
cmake --build build/release
cp build/release/bun /path/to/dotenc/cli/custom-bun/bun
```

---

## Bug 2: Encrypted RSA error path poisons later Ed25519 key parsing

**Status: Open** (workaround in place in dotenc).

### Summary

After a failed `crypto.createPrivateKey()` call on a legacy encrypted RSA PEM key (`-----BEGIN RSA PRIVATE KEY-----` with `Proc-Type: 4,ENCRYPTED`), Bun can no longer parse a valid OpenSSH Ed25519 private key in the same process. The same Ed25519 key parses successfully before the encrypted-RSA error path, then fails after it.

Observed on Bun 1.3.9.

### Why it matters to dotenc

`dotenc` scans `~/.ssh` and tries multiple keys. If `~/.ssh` contains a legacy passphrase-protected RSA PEM key, the failing `createPrivateKey()` call corrupts internal state and prevents later Ed25519 key imports. This caused flaky/empty key lists in `getPrivateKeys()`.

### Repro

```bash
bun docs/bun-test-bugs/bun-crypto-encrypted-rsa-poisons-ed25519/repro-bun-encrypted-rsa-poisons-ed25519.ts
# Exits 1 when bug is present, 0 when fixed
```

Repro file: `bun-crypto-encrypted-rsa-poisons-ed25519/`

The script:
1. Generates an unencrypted OpenSSH Ed25519 key.
2. Generates a legacy encrypted RSA PEM key.
3. Parses the Ed25519 key → succeeds.
4. Calls `crypto.createPrivateKey()` on the encrypted RSA PEM → throws (expected).
5. Parses the same Ed25519 key again → **fails** (the bug).

### Root cause hypothesis

The encrypted-PEM error path likely leaves the OpenSSL error queue or some internal parsing state uncleaned. A subsequent DER PKCS#8 Ed25519 import picks up that stale state and fails.

### dotenc workaround

`getPrivateKeys()` results are memoized within a single command invocation so the poisoned code path is never reached twice.

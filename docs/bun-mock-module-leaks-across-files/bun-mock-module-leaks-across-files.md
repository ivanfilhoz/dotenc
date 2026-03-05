# Bun test repro: `mock.module` leaks across test files in the same `bun test` invocation

## Summary

We found a Bun test runtime bug (observed on **Bun 1.3.9** and confirmed still present on **Bun 1.3.11-debug** built from the current `oven-sh/bun` main branch) where a `mock.module()` call in one test file permanently replaces the module in the shared module registry, causing subsequent test files that import the same module to receive the mocked version instead of the real one.

Calling `mock.restore()` in `afterAll()` of the mocking file does **not** prevent the leak.

## Why this matters to `dotenc`

`dotenc` has a test suite with:

- **Command tests** that use `mock.module()` to replace helper modules (e.g. `validateKeyName`, `resolveProjectRoot`, `node:fs/promises`) so commands can be tested in isolation.
- **Helper tests** that import and exercise those same modules with their real implementations.

When both groups run in the same `bun test` invocation, the helper tests receive mocked module exports instead of the real implementations. This causes failures that are impossible to reproduce by running the helper test file in isolation.

The workaround — running command tests and helper tests as two separate `bun test` invocations — is functional but requires the test script to enumerate all files explicitly, which is unmaintainable.

## Minimal standalone repro

Files:

- `repro-greeting.ts` — a trivial module with one exported function
- `repro-a-mock.test.ts` — calls `mock.module("./repro-greeting", ...)` and includes `afterAll(() => mock.restore())` to show restoration does not help
- `repro-b-real.test.ts` — imports the real `repro-greeting` and asserts real behavior

Run:

```bash
cd /Users/ivanfilho/Projetos/dotenc/docs/bun-mock-module-leaks-across-files

# File B alone — PASSES
bun test repro-b-real.test.ts

# Both files — repro-b-real.test.ts FAILS
bun test repro-a-mock.test.ts repro-b-real.test.ts
```

Expected output (both files):

```
 2 pass
 0 fail
```

Actual output on Bun 1.3.9 and Bun 1.3.11-debug (current main):

```
error: expect(received).toBe(expected)
Expected: "Hello, world!"
Received: "MOCKED"

(fail) real greet says hello

 1 pass
 1 fail
```

## Key observations

- The bug only occurs when both files are passed to the **same** `bun test` invocation. Running each file separately passes.
- File ordering matters: the mock file must run first. Since Bun processes files in the order given (or alphabetically), `repro-a-mock.test.ts` runs before `repro-b-real.test.ts`.
- `mock.restore()` in `afterAll()` of the mocking file does **not** restore the module for subsequently loaded test files.
- The leak is via the shared module registry within the Bun worker process. Once `mock.module()` replaces a module, all subsequent `import` calls for that specifier — even in other test files — resolve to the mock.

## Prompt for a separate session on Bun's codebase

Use the repro files above as the test case. Please investigate Bun's `mock.module()` implementation and module registry lifetime management within a single `bun test` process.

### Goal

Fix Bun so that `mock.module()` replacements are scoped to the test file that called them and do not affect module resolution in subsequently executed test files within the same `bun test` invocation.

### What to inspect

- The `mock.module()` implementation and where it writes to the module registry.
- Whether the module registry is reset between test files, and if not, why.
- The `mock.restore()` implementation and why it does not undo `mock.module()` replacements for other files' `import` bindings.
- Whether test files each get an isolated module namespace/registry, or share one for the entire process.
- The test file execution model: are files run in separate workers, separate realms, or the same context?

### Acceptance criteria

- `bun test repro-a-mock.test.ts repro-b-real.test.ts` exits `0` with 2 passing tests.
- `mock.module()` replacements do not leak to other test files.
- OR: `mock.restore()` (when called in `afterAll`) fully restores the module registry such that subsequently loaded test files see the real implementation.

## dotenc workaround in place

`dotenc` currently splits the `bun test` command into two sequential invocations in `package.json` to keep command tests and helper tests in separate processes. This prevents the leak but does not fix the underlying Bun bug.

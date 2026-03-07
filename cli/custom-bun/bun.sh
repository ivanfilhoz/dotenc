#!/bin/sh
# Use the patched bun binary on macOS (where it was compiled).
# Fall back to system bun on other platforms (e.g. Linux CI).
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$(uname -s)" = "Darwin" ]; then
  exec "$DIR/bun" "$@"
else
  exec bun "$@"
fi

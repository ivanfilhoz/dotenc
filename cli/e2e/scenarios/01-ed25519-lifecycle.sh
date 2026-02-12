#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/setup.sh"
source "$SCRIPT_DIR/../lib/assertions.sh"

echo "--- Scenario: Ed25519 Lifecycle ---"

# Setup
ALICE_HOME=$(mktemp -d /tmp/e2e-01-alice-XXXXXX)
WORKSPACE=$(mktemp -d /tmp/e2e-01-workspace-XXXXXX)
generate_ed25519_key "$ALICE_HOME"

# Init
run_cli "$ALICE_HOME" "$WORKSPACE" init
assert_file_exists "$WORKSPACE/dotenc.json"
assert_file_exists "$WORKSPACE/.env"
assert_file_exists "$WORKSPACE/.dotenc/id_ed25519.pub"

# Create
run_cli "$ALICE_HOME" "$WORKSPACE" create staging id_ed25519
assert_file_exists "$WORKSPACE/.env.staging.enc"
assert_json_field "$WORKSPACE/.env.staging.enc" "keys[0].algorithm" "ed25519"

# Edit (mock editor writes MY_SECRET=hunter2)
EDITOR=$(create_mock_editor "MY_SECRET=hunter2")
export EDITOR

BEFORE_EDIT=$(cat "$WORKSPACE/.env.staging.enc")
run_cli "$ALICE_HOME" "$WORKSPACE" edit staging
AFTER_EDIT=$(cat "$WORKSPACE/.env.staging.enc")
[ "$BEFORE_EDIT" != "$AFTER_EDIT" ] || fail "Edit did not change the encrypted file"

# Run
output=$(run_cli "$ALICE_HOME" "$WORKSPACE" run -e staging -- sh -c 'echo $MY_SECRET' 2>/dev/null)
assert_output_contains "$output" "hunter2"

# Cleanup
rm -rf "$ALICE_HOME" "$WORKSPACE"
echo "--- PASSED: Ed25519 Lifecycle ---"

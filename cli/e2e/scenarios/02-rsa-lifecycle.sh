#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/setup.sh"
source "$SCRIPT_DIR/../lib/assertions.sh"

echo "--- Scenario: RSA Lifecycle ---"

# Setup
ALICE_HOME=$(mktemp -d /tmp/e2e-02-alice-XXXXXX)
WORKSPACE=$(mktemp -d /tmp/e2e-02-workspace-XXXXXX)
generate_rsa_key "$ALICE_HOME"

# Init
run_cli "$ALICE_HOME" "$WORKSPACE" init
assert_file_exists "$WORKSPACE/dotenc.json"
assert_file_exists "$WORKSPACE/.env"
assert_file_exists "$WORKSPACE/.dotenc/id_rsa.pub"

# Create
run_cli "$ALICE_HOME" "$WORKSPACE" create staging id_rsa
assert_file_exists "$WORKSPACE/.env.staging.enc"
assert_json_field "$WORKSPACE/.env.staging.enc" "keys[0].algorithm" "rsa"

# Edit (mock editor writes DB_PASSWORD=s3cure)
EDITOR=$(create_mock_editor "DB_PASSWORD=s3cure")
export EDITOR

BEFORE_EDIT=$(cat "$WORKSPACE/.env.staging.enc")
run_cli "$ALICE_HOME" "$WORKSPACE" edit staging
AFTER_EDIT=$(cat "$WORKSPACE/.env.staging.enc")
[ "$BEFORE_EDIT" != "$AFTER_EDIT" ] || fail "Edit did not change the encrypted file"

# Run
output=$(run_cli "$ALICE_HOME" "$WORKSPACE" run -e staging -- sh -c 'echo $DB_PASSWORD' 2>/dev/null)
assert_output_contains "$output" "s3cure"

# Cleanup
rm -rf "$ALICE_HOME" "$WORKSPACE"
echo "--- PASSED: RSA Lifecycle ---"

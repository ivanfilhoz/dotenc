#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/setup.sh"
source "$SCRIPT_DIR/../lib/assertions.sh"

echo "--- Scenario: Mixed Keys ---"

# Setup
ALICE_HOME=$(mktemp -d /tmp/e2e-05-alice-XXXXXX)
BOB_HOME=$(mktemp -d /tmp/e2e-05-bob-XXXXXX)
WORKSPACE=$(mktemp -d /tmp/e2e-05-workspace-XXXXXX)
generate_ed25519_key "$ALICE_HOME"
generate_rsa_key "$BOB_HOME"

# Alice inits project and creates env
run_cli "$ALICE_HOME" "$WORKSPACE" init
run_cli "$ALICE_HOME" "$WORKSPACE" create staging id_ed25519

# Alice edits env
EDITOR=$(create_mock_editor "SHARED_SECRET=mix123")
export EDITOR
run_cli "$ALICE_HOME" "$WORKSPACE" edit staging

# Alice adds Bob's RSA key
run_cli "$ALICE_HOME" "$WORKSPACE" key add bob --from-ssh "$BOB_HOME/.ssh/id_rsa"

# Alice grants Bob
run_cli "$ALICE_HOME" "$WORKSPACE" grant staging bob
assert_json_array_length "$WORKSPACE/.env.staging.enc" "keys" "2"

# Check key algorithms
assert_json_field "$WORKSPACE/.env.staging.enc" "keys[0].algorithm" "ed25519"
assert_json_field "$WORKSPACE/.env.staging.enc" "keys[1].algorithm" "rsa"

# Alice can decrypt
output=$(run_cli "$ALICE_HOME" "$WORKSPACE" run -e staging -- sh -c 'echo $SHARED_SECRET' 2>/dev/null)
assert_output_contains "$output" "mix123"

# Bob can decrypt
output=$(run_cli "$BOB_HOME" "$WORKSPACE" run -e staging -- sh -c 'echo $SHARED_SECRET' 2>/dev/null)
assert_output_contains "$output" "mix123"

# Cleanup
rm -rf "$ALICE_HOME" "$BOB_HOME" "$WORKSPACE"
echo "--- PASSED: Mixed Keys ---"

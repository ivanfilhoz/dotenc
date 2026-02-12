#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/setup.sh"
source "$SCRIPT_DIR/../lib/assertions.sh"

echo "--- Scenario: Multi-User ---"

# Setup
ALICE_HOME=$(mktemp -d /tmp/e2e-03-alice-XXXXXX)
BOB_HOME=$(mktemp -d /tmp/e2e-03-bob-XXXXXX)
WORKSPACE=$(mktemp -d /tmp/e2e-03-workspace-XXXXXX)
generate_ed25519_key "$ALICE_HOME"
generate_rsa_key "$BOB_HOME"

# Alice inits project
run_cli "$ALICE_HOME" "$WORKSPACE" init
assert_file_exists "$WORKSPACE/dotenc.json"

# Alice creates production env
run_cli "$ALICE_HOME" "$WORKSPACE" create production id_ed25519

# Alice edits production env
EDITOR=$(create_mock_editor "API_KEY=super-secret-key")
export EDITOR
run_cli "$ALICE_HOME" "$WORKSPACE" edit production

# Alice adds Bob's public key
run_cli "$ALICE_HOME" "$WORKSPACE" key add bob --from-ssh "$BOB_HOME/.ssh/id_rsa"
assert_file_exists "$WORKSPACE/.dotenc/bob.pub"

# Alice grants Bob access
run_cli "$ALICE_HOME" "$WORKSPACE" grant production bob
assert_json_array_length "$WORKSPACE/.env.production.enc" "keys" "2"

# Bob can decrypt
output=$(run_cli "$BOB_HOME" "$WORKSPACE" run -e production -- sh -c 'echo $API_KEY' 2>/dev/null)
assert_output_contains "$output" "super-secret-key"

# Alice revokes Bob
run_cli "$ALICE_HOME" "$WORKSPACE" revoke production bob
assert_json_array_length "$WORKSPACE/.env.production.enc" "keys" "1"

# Bob cannot decrypt after revocation
output=$(run_cli "$BOB_HOME" "$WORKSPACE" run -e production -- sh -c 'echo $API_KEY' 2>/dev/null) || true
assert_output_not_contains "$output" "super-secret-key"

# Cleanup
rm -rf "$ALICE_HOME" "$BOB_HOME" "$WORKSPACE"
echo "--- PASSED: Multi-User ---"

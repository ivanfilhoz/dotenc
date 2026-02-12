#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/setup.sh"
source "$SCRIPT_DIR/../lib/assertions.sh"

echo "--- Scenario: DOTENC_PRIVATE_KEY ---"

# Setup
ALICE_HOME=$(mktemp -d /tmp/e2e-04-alice-XXXXXX)
CI_HOME=$(mktemp -d /tmp/e2e-04-ci-XXXXXX)
WORKSPACE=$(mktemp -d /tmp/e2e-04-workspace-XXXXXX)
generate_ed25519_key "$ALICE_HOME"

# Alice inits and creates env
run_cli "$ALICE_HOME" "$WORKSPACE" init
run_cli "$ALICE_HOME" "$WORKSPACE" create staging id_ed25519

# Alice edits env
EDITOR=$(create_mock_editor "DEPLOY_TOKEN=tok_abc123")
export EDITOR
run_cli "$ALICE_HOME" "$WORKSPACE" edit staging

# Verify Alice can run normally
output=$(run_cli "$ALICE_HOME" "$WORKSPACE" run -e staging -- sh -c 'echo $DEPLOY_TOKEN' 2>/dev/null)
assert_output_contains "$output" "tok_abc123"

# CI simulation: no .ssh/ directory, use DOTENC_PRIVATE_KEY
export DOTENC_PRIVATE_KEY=$(cat "$ALICE_HOME/.ssh/id_ed25519")
output=$(run_cli "$CI_HOME" "$WORKSPACE" run -e staging -- sh -c 'echo $DEPLOY_TOKEN' 2>/dev/null)
assert_output_contains "$output" "tok_abc123"
unset DOTENC_PRIVATE_KEY

# Cleanup
rm -rf "$ALICE_HOME" "$CI_HOME" "$WORKSPACE"
echo "--- PASSED: DOTENC_PRIVATE_KEY ---"

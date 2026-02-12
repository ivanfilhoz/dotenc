#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

PASSED=0
FAILED=0
FAILURES=""

for scenario in "$SCRIPT_DIR"/scenarios/*.sh; do
    name=$(basename "$scenario")
    echo ""
    echo "========================================"
    echo "Running: $name"
    echo "========================================"

    if bash "$scenario"; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
        FAILURES="$FAILURES\n  - $name"
    fi
done

echo ""
echo "========================================"
echo "Results: $PASSED passed, $FAILED failed"
if [ $FAILED -gt 0 ]; then
    echo -e "Failed:$FAILURES"
    echo "========================================"
    exit 1
fi
echo "========================================"

#!/usr/bin/env bash
set -euo pipefail

include_e2e_cli=0
if [[ "${1:-}" == "--include-e2e-cli" ]]; then
	include_e2e_cli=1
	shift
fi

report() {
	local label="$1"
	shift

	awk -F: -v label="$label" '
		/^LF:/ { lf += $2 }
		/^LH:/ { lh += $2 }
		/^FNF:/ { fnf += $2 }
		/^FNH:/ { fnh += $2 }
		/^BRF:/ { brf += $2 }
		/^BRH:/ { brh += $2 }
		END {
			linePct = lf ? (100 * lh / lf) : 0
			funcPct = fnf ? (100 * fnh / fnf) : 0
			branchPct = brf ? sprintf("%.2f%%", 100 * brh / brf) : "n/a"
			printf("%s lines=%d/%d (%.2f%%) funcs=%d/%d (%.2f%%) branches=%d/%d (%s)\n", label, lh, lf, linePct, fnh, fnf, funcPct, brh, brf, branchPct)
		}
	' "$@"
}

report_no_func() {
	local label="$1"
	shift

	awk -F: -v label="$label" '
		/^LF:/ { lf += $2 }
		/^LH:/ { lh += $2 }
		/^BRF:/ { brf += $2 }
		/^BRH:/ { brh += $2 }
		END {
			linePct = lf ? (100 * lh / lf) : 0
			branchPct = brf ? sprintf("%.2f%%", 100 * brh / brf) : "n/a"
			printf("%s lines=%d/%d (%.2f%%) funcs=n/a branches=%d/%d (%s)\n", label, lh, lf, linePct, brh, brf, branchPct)
		}
	' "$@"
}

if [[ "$include_e2e_cli" == "1" ]]; then
	if [[ ! -f "cli/coverage-e2e/lcov.info" ]]; then
		echo "Missing CLI e2e coverage report: cli/coverage-e2e/lcov.info" >&2
		echo "Run 'cd cli && bun run test:e2e:coverage' first." >&2
		exit 1
	fi

	bun ./scripts/merge-lcov.ts \
		cli/coverage-merged/lcov.info \
		cli/coverage/lcov.info \
		cli/coverage-e2e/lcov.info

	cli_unit_has_fn_details=0
	if rg -q '^FN:' cli/coverage/lcov.info; then
		cli_unit_has_fn_details=1
	fi

	report "CLI_UNIT" "cli/coverage/lcov.info"
	report "CLI_E2E_RUNTIME" "cli/coverage-e2e/lcov.info"

	if rg -q '^SF:src/' cli/coverage-e2e/lcov.info; then
		if [[ "$cli_unit_has_fn_details" == "1" ]]; then
			report "CLI_COMBINED" "cli/coverage-merged/lcov.info"
		else
			report_no_func "CLI_COMBINED" "cli/coverage-merged/lcov.info"
			echo "NOTE: Bun unit LCOV omits FN/FNDA records (summary-only FNF/FNH), so exact merged function coverage with e2e LCOV is not computable."
		fi
		report "VSCodeExt" "vscode-extension/coverage/lcov.info"
		if [[ "$cli_unit_has_fn_details" == "1" ]]; then
			report "COMBINED" "cli/coverage-merged/lcov.info" "vscode-extension/coverage/lcov.info"
		else
			report_no_func "COMBINED" "cli/coverage-merged/lcov.info" "vscode-extension/coverage/lcov.info"
		fi
	else
		echo "NOTE: CLI e2e coverage is reported against runtime bundle paths (e.g. dist/cli.js), so it is shown separately and not merged into source-based totals."
		report "VSCodeExt" "vscode-extension/coverage/lcov.info"
		report "COMBINED" "cli/coverage/lcov.info" "vscode-extension/coverage/lcov.info"
	fi
else
	report "CLI" "cli/coverage/lcov.info"
	report "VSCodeExt" "vscode-extension/coverage/lcov.info"
	report "COMBINED" "cli/coverage/lcov.info" "vscode-extension/coverage/lcov.info"
fi

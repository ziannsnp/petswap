#!/usr/bin/env bash
# Every Gherkin scenario under docs/acceptance/ must name at least one executable check in a
# "# Verified by: <path>" comment above it, and every named path must exist.
# Idempotent and read-only. Run from anywhere: bash scripts/check-acceptance-traceability.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

status=0
scenarios=0

for feature in docs/acceptance/*.feature; do
  pending=0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      *"# Verified by:"*)
        pending=$((pending + 1))
        path="$(printf '%s' "$line" | sed -E 's/.*# Verified by:[[:space:]]*//; s/[[:space:]]+$//')"
        if [ ! -e "$path" ]; then
          echo "::error file=$feature::Verified-by path does not exist: $path"
          status=1
        fi
        ;;
      *Scenario:* | *"Scenario Outline:"*)
        scenarios=$((scenarios + 1))
        if [ "$pending" -eq 0 ]; then
          echo "::error file=$feature::Scenario has no '# Verified by:' line: $(printf '%s' "$line" | sed -E 's/^[[:space:]]+//')"
          status=1
        fi
        pending=0
        ;;
    esac
  done < "$feature"
done

echo "checked $scenarios scenarios"
exit $status

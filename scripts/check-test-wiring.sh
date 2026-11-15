#!/usr/bin/env bash
# Fails when a test exists but nothing in CI runs it:
#   - every web/e2e/*.spec.ts must be named in some .github/workflows/*.yml
#   - db-contract.yml must run supabase/tests by glob (so no SQL file can be forgotten)
# Jest finds its own files by pattern, so it needs no check here.
# Idempotent and read-only. Run from anywhere: bash scripts/check-test-wiring.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

status=0

for spec in web/e2e/*.spec.ts; do
  name="$(basename "$spec")"
  if ! grep -qF "$name" .github/workflows/*.yml; then
    echo "::error file=$spec::No workflow runs $name. Add it to an e2e workflow."
    status=1
  fi
done

if ! grep -q 'supabase/tests/\*.test.sql' .github/workflows/db-contract.yml; then
  echo "::error file=.github/workflows/db-contract.yml::SQL tests are no longer run by glob; a new file could be left out."
  status=1
fi

echo "test wiring check done (status $status)"
exit $status

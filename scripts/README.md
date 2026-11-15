# Scripts

Add only idempotent, documented scripts here. Scripts should reconcile a known desired state rather than perform one-off manual operations.

Read a script's header before running it.

| Script | Purpose |
| --- | --- |
| `stack-env.sh` | Writes `.env` for `docker-compose.yml` from `.env.example` with generated secrets. Leaves an existing `.env` untouched. |
| `release_gate.py` | Read-only release gate. For a commit on `main`, reads each required check (from `.github/rulesets/main-branch-ruleset.json`) on the pull request that produced it, prints a release record, and exits non-zero when one is missing or failed. Run by `Release gate` in `quality.yml`; see [Release gate](../docs/ci-cd.md#release-gate). |
| `stack-health.sh` | Read-only health and smoke check for the Compose stack. Exits non-zero and names each missing setting, stopped service, or failing request. |

The two `stack-*` scripts are POSIX `sh` and run from Git Bash on Windows. See [Docker Compose stack](../docs/environments.md#docker-compose-stack).

#!/usr/bin/env python3
"""Release gate for main (US-D.5): block publishing unless every required check passed.

For a commit on main, find the pull request that merged it, read the conclusion of
every required status check on that pull request's head commit, and write a release
record. Exits 1 (blocks the release) when a required check is missing or did not pass,
or when no merged pull request produced the commit.

The required check names are read from .github/rulesets/main-branch-ruleset.json, the
same file the repository admin applies to the ruleset, so the gate and branch
protection cannot drift apart.

Read-only and idempotent. Needs GITHUB_TOKEN (or GH_TOKEN) with contents, checks and
pull-requests read. Usage:
  python3 scripts/release_gate.py --repo owner/name --sha <commit> [--record out.json]
In GitHub Actions it also appends a Markdown table to $GITHUB_STEP_SUMMARY.
"""
import argparse
import json
import os
import pathlib
import sys
import time
import urllib.request

PASSING = {"success", "skipped", "neutral"}
ROOT = pathlib.Path(__file__).resolve().parent.parent
RULESET = ROOT / ".github" / "rulesets" / "main-branch-ruleset.json"


def required_contexts():
    ruleset = json.loads(RULESET.read_text(encoding="utf-8"))
    for rule in ruleset["rules"]:
        if rule["type"] == "required_status_checks":
            return [c["context"] for c in rule["parameters"]["required_status_checks"]]
    raise SystemExit(f"{RULESET} has no required_status_checks rule")


def api(path, token):
    request = urllib.request.Request(
        f"https://api.github.com/{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def merged_pull_request(repo, sha, token):
    # The commit-to-PR association can lag a few seconds behind the push.
    for attempt in range(4):
        pulls = api(f"repos/{repo}/commits/{sha}/pulls", token)
        merged = [p for p in pulls if p.get("merged_at") and p["base"]["ref"] == "main"]
        if merged:
            return merged[0]
        if attempt < 3:
            time.sleep(10 * (attempt + 1))
    return None


def check_runs(repo, sha, token):
    runs, page = [], 1
    while True:
        batch = api(f"repos/{repo}/commits/{sha}/check-runs?per_page=100&page={page}", token)
        runs.extend(batch["check_runs"])
        if len(batch["check_runs"]) < 100:
            return runs
        page += 1


def latest_by_name(runs):
    # A re-run creates a new check run with the same name; the newest one counts.
    def stamp(run):
        return run.get("completed_at") or run.get("started_at") or ""

    latest = {}
    for run in runs:
        name = run["name"]
        if name not in latest or stamp(run) > stamp(latest[name]):
            latest[name] = run
    return latest


def build_record(repo, sha, token):
    record = {
        "repository": repo,
        "commit": sha,
        "version": f"main-{sha[:7]}",
        "run_url": None,
        "pull_request": None,
        "checked_commit": None,
        "checks": [],
        "verdict": "blocked",
        "reason": None,
    }
    if os.environ.get("GITHUB_RUN_ID"):
        server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        record["run_url"] = f"{server}/{repo}/actions/runs/{os.environ['GITHUB_RUN_ID']}"

    pr = merged_pull_request(repo, sha, token)
    if pr is None:
        record["reason"] = "no merged pull request produced this commit, so its required checks cannot be verified"
        return record

    head = pr["head"]["sha"]
    record["pull_request"] = {"number": pr["number"], "url": pr["html_url"], "title": pr["title"]}
    record["checked_commit"] = head
    runs = latest_by_name(check_runs(repo, head, token))
    failing = []
    for context in required_contexts():
        run = runs.get(context)
        conclusion = "missing" if run is None else (run["conclusion"] or run["status"])
        record["checks"].append({
            "name": context,
            "conclusion": conclusion,
            "url": None if run is None else run["html_url"],
        })
        if conclusion not in PASSING:
            failing.append(context)
    if failing:
        record["reason"] = "required check(s) did not pass: " + ", ".join(failing)
    else:
        record["verdict"] = "released"
    return record


def write_summary(record, path):
    pr = record["pull_request"]
    lines = [
        f"### Release record: `{record['version']}` ({record['verdict'].upper()})",
        "",
        f"- Commit: `{record['commit']}`",
        f"- Pull request: [#{pr['number']}]({pr['url']}) {pr['title']}" if pr else "- Pull request: none found",
    ]
    if record["checked_commit"]:
        lines.append(f"- Checks read from the pull request head: `{record['checked_commit']}`")
    if record["reason"]:
        lines.append(f"- Blocked because: {record['reason']}")
    lines += ["", "| Required check | Conclusion |", "| --- | --- |"]
    for check in record["checks"]:
        name = f"[{check['name']}]({check['url']})" if check["url"] else check["name"]
        lines.append(f"| {name} | {check['conclusion']} |")
    with open(path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Block a release unless every required check passed.")
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--sha", default=os.environ.get("GITHUB_SHA"))
    parser.add_argument("--record", help="also write the release record as JSON to this path")
    args = parser.parse_args()
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not (args.repo and args.sha and token):
        parser.error("need --repo, --sha and GITHUB_TOKEN (or GH_TOKEN)")

    record = build_record(args.repo, args.sha, token)
    if args.record:
        pathlib.Path(args.record).write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        write_summary(record, os.environ["GITHUB_STEP_SUMMARY"])
    print(json.dumps(record, indent=2))
    if record["verdict"] != "released":
        print(f"::error::Release blocked for {record['version']}: {record['reason']}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

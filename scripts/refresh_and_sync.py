#!/usr/bin/env python3
"""Trigger deployed refresh, sync Worker history locally, regenerate reports, and smoke test.

This script performs the operational full cycle. It requires --yes before it
will call /api/refresh because refresh uses Tavily/model quota and writes KV.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_BASE_URL = "https://pivot-framework-api.xuejiadi.workers.dev"
ROOT = Path(__file__).resolve().parents[1]


def fetch_json(url: str, method: str = "GET") -> dict:
    request = urllib.request.Request(
        url,
        method=method,
        headers={"User-Agent": "pivot-framework-refresh-sync/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return json.loads(response.read().decode(charset))
    except (OSError, urllib.error.URLError) as exc:
        if os.name != "nt":
            raise
        return fetch_json_with_powershell(url, method, exc)


def fetch_json_with_powershell(url: str, method: str, original_error: BaseException) -> dict:
    command = (
        "$ProgressPreference='SilentlyContinue'; "
        "Invoke-RestMethod -Uri $args[0] -Method $args[1] "
        "-Headers @{ 'User-Agent' = 'pivot-framework-refresh-sync/1.0' } | "
        "ConvertTo-Json -Depth 100 -Compress"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command, url, method],
            check=True,
            capture_output=True,
            text=True,
            timeout=240,
        )
    except (OSError, subprocess.SubprocessError) as fallback_error:
        raise RuntimeError(
            f"Python HTTP failed ({original_error}); PowerShell fallback failed ({fallback_error})"
        ) from fallback_error
    return json.loads(result.stdout)


def run(command: list[str]) -> None:
    print("$ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def print_refresh_summary(data: dict) -> None:
    print(f"Refresh date: {data.get('date')}")
    if data.get("_refreshedAt"):
        print(f"Refreshed at: {data['_refreshedAt']}")
    if data.get("scenario_probs"):
        print(f"Scenario probabilities: {data['scenario_probs']}")
    if data.get("threshold_alerts"):
        print("Threshold alerts:")
        for alert in data["threshold_alerts"]:
            print(f"- {alert}")
    if data.get("headline"):
        print(f"Headline: {data['headline']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Worker base URL")
    parser.add_argument("--yes", action="store_true", help="confirm the refresh call that uses API quota and writes KV")
    parser.add_argument("--skip-refresh", action="store_true", help="skip POST /api/refresh and only sync/report/smoke")
    parser.add_argument("--no-smoke", action="store_true", help="skip production smoke test")
    parser.add_argument("--no-report", action="store_true", help="skip local report generation")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    if not args.skip_refresh:
        if not args.yes:
            print("Refusing to call /api/refresh without --yes because it uses API quota and writes KV.", file=sys.stderr)
            print("Run with --yes to refresh, or --skip-refresh to only sync/report/smoke.", file=sys.stderr)
            return 2
        print(f"POST {base_url}/api/refresh", flush=True)
        refresh_data = fetch_json(base_url + "/api/refresh", method="POST")
        print_refresh_summary(refresh_data)

    run([sys.executable, "scripts/sync_worker_history.py", "--base-url", base_url, "--write"])

    if not args.no_report:
        run([sys.executable, "scripts/generate_reports.py"])

    if not args.no_smoke:
        run(["node", "scripts/smoke_worker.mjs", f"--worker={base_url}"])

    print("Refresh/sync cycle complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

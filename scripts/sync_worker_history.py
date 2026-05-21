#!/usr/bin/env python3
"""Merge deployed Worker history into local data/weekly_log.json.

This script uses the public Worker API instead of direct Cloudflare KV access.
By default it performs a dry run. Pass --write to update the local JSON file.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_BASE_URL = "https://pivot-framework-api.xuejiadi.workers.dev"
ROOT = Path(__file__).resolve().parents[1]
LOCAL_LOG = ROOT / "data" / "weekly_log.json"


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "pivot-framework-sync/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return json.loads(response.read().decode(charset))
    except (OSError, urllib.error.URLError) as exc:
        if os.name != "nt":
            raise
        return fetch_json_with_powershell(url, exc)


def fetch_json_with_powershell(url: str, original_error: BaseException) -> dict:
    command = (
        "$ProgressPreference='SilentlyContinue'; "
        "Invoke-RestMethod -Uri $args[0] -Method Get "
        "-Headers @{ 'User-Agent' = 'pivot-framework-sync/1.0' } | "
        "ConvertTo-Json -Depth 100 -Compress"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command, url],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as fallback_error:
        raise RuntimeError(
            f"Python HTTP failed ({original_error}); PowerShell fallback failed ({fallback_error})"
        ) from fallback_error
    return json.loads(result.stdout)


def canonicalize_entry(entry: dict) -> dict:
    """Keep the Worker payload shape compatible with docs/output_schemas.md."""
    result = dict(entry)
    result.setdefault("readings", {})
    result.setdefault("scenario_probs", {})
    result.setdefault("scenarios", {})
    result.setdefault("threshold_alerts", [])
    result.setdefault("headline", "")
    result.setdefault("positioning_update", "")
    result.setdefault("elaborations", {})
    result.setdefault("notes", "")
    return result


def load_local_history(path: Path) -> tuple[object, list[dict]]:
    if not path.exists():
        return [], []
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data, data
    if isinstance(data, dict) and isinstance(data.get("entries"), list):
        return data, data["entries"]
    raise ValueError(f"{path} must contain a JSON array or an object with an entries array")


def apply_entries_to_history(original: object, entries: list[dict]) -> object:
    if isinstance(original, dict):
        updated = dict(original)
        updated["entries"] = entries
        return updated
    return entries


def merge_by_date(local_entries: list[dict], worker_entries: list[dict]) -> tuple[list[dict], int, int]:
    merged = {entry.get("date"): entry for entry in local_entries if entry.get("date")}
    added = 0
    updated = 0

    for entry in worker_entries:
        date = entry.get("date")
        if not date:
            continue
        canonical = canonicalize_entry(entry)
        if date in merged:
            if merged[date] != canonical:
                updated += 1
        else:
            added += 1
        merged[date] = canonical

    return [merged[d] for d in sorted(merged)], added, updated


def collect_worker_entries(base_url: str) -> list[dict]:
    base = base_url.rstrip("/")
    history = fetch_json(base + "/api/history")
    dates = history.get("dates") or [entry.get("date") for entry in history.get("entries", [])]
    dates = [d for d in dates if d]

    entries = []
    for date in dates:
        query = urllib.parse.urlencode({"date": date})
        entries.append(fetch_json(base + "/api/history?" + query))
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Worker base URL")
    parser.add_argument("--log", default=str(LOCAL_LOG), help="local weekly_log.json path")
    parser.add_argument("--write", action="store_true", help="write merged history to the local log")
    args = parser.parse_args()

    log_path = Path(args.log).resolve()
    try:
        original_history, local_entries = load_local_history(log_path)
        worker_entries = collect_worker_entries(args.base_url)
        merged, added, updated = merge_by_date(local_entries, worker_entries)
    except (OSError, urllib.error.URLError, json.JSONDecodeError, ValueError) as exc:
        print(f"sync failed: {exc}", file=sys.stderr)
        return 1

    print(f"Worker entries fetched: {len(worker_entries)}")
    print(f"Local entries before: {len(local_entries)}")
    print(f"Entries added: {added}")
    print(f"Entries updated: {updated}")
    print(f"Local entries after merge: {len(merged)}")

    if args.write:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("w", encoding="utf-8") as f:
            json.dump(apply_entries_to_history(original_history, merged), f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Wrote {log_path}")
    else:
        print("Dry run only. Re-run with --write to update the local log.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

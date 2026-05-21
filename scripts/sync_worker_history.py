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
SCENARIO_PROB_KEYS = {
    "s1": "s1_no_pivot",
    "s2": "s2_tariff_rollback",
    "s3": "s3_oil_trap",
}


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


def to_number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = (
            value.replace("%", "")
            .replace("$", "")
            .replace(",", "")
            .replace("+", "")
            .replace("bp", "")
            .strip()
        )
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def normalize_probability(value: object) -> float | None:
    parsed = to_number(value)
    if parsed is None:
        return None
    if parsed > 1:
        parsed = parsed / 100
    return round(parsed, 4)


def normalize_scenario_probabilities(entry: dict) -> dict[str, float]:
    probs = entry.get("scenario_probs") or {}
    scenarios = entry.get("scenarios") or {}
    normalized: dict[str, float | None] = {}

    for legacy_key, canonical_key in SCENARIO_PROB_KEYS.items():
        value = normalize_probability(probs.get(canonical_key))
        if value is None:
            value = normalize_probability((scenarios.get(legacy_key) or {}).get("prob"))
        normalized[canonical_key] = value

    missing = [key for key, value in normalized.items() if value is None]
    known_total = sum(value for value in normalized.values() if value is not None)
    if missing:
        fill = max(0.0, 1.0 - known_total) / len(missing)
        for key in missing:
            normalized[key] = fill

    total = sum(normalized.values())
    if total <= 0:
        normalized = {
            "s1_no_pivot": 1 / 3,
            "s2_tariff_rollback": 1 / 3,
            "s3_oil_trap": 1 / 3,
        }
        total = 1.0

    scaled = {key: round(value / total, 4) for key, value in normalized.items()}
    drift = round(1.0 - sum(scaled.values()), 4)
    if drift:
        last_key = "s3_oil_trap"
        scaled[last_key] = round(scaled[last_key] + drift, 4)
    return scaled


def parse_generic_ballot(value: object) -> float | None:
    if not isinstance(value, str):
        return None
    text = value.strip().upper().replace(" ", "")
    if not text:
        return None
    sign = 1
    if text.startswith("D+"):
        text = text[2:]
    elif text.startswith("R+"):
        sign = -1
        text = text[2:]
    else:
        return None
    parsed = to_number(text)
    return parsed * sign if parsed is not None else None


def format_value(value: float, unit: str = "") -> str:
    if unit == "$":
        return f"${value:.2f}".rstrip("0").rstrip(".")
    if unit == "%":
        return f"{value:.2f}%".rstrip("0").rstrip(".")
    return f"{value:.2f}".rstrip("0").rstrip(".")


def threshold_alert(metric: str, value: float, warning: float, critical: float, unit: str = "", below: bool = False) -> str | None:
    if below:
        if value < critical:
            return f"CRITICAL: {metric} ({format_value(value, unit)}) crossed critical threshold"
        if value < warning:
            return f"WARNING: {metric} ({format_value(value, unit)}) crossed warning threshold"
        return None

    if value > critical:
        return f"CRITICAL: {metric} ({format_value(value, unit)}) crossed critical threshold"
    if value > warning:
        return f"WARNING: {metric} ({format_value(value, unit)}) crossed warning threshold"
    return None


def build_threshold_alerts(readings: dict) -> list[str]:
    alerts: list[str] = []

    checks = [
        ("Econ approval", "econ_approval", 30, 25, "%", True),
        ("GOP approval", "gop_approval", 80, 75, "%", True),
        ("VIX", "vix", 30, 40, "", False),
        ("WTI crude", "wti", 100, 120, "$", False),
        ("Gas price avg", "gas_price", 4.00, 5.00, "$", False),
        ("10Y yield", "yield_10y", 4.60, 5.00, "%", False),
        ("2s10s spread", "spread_2s10s", 0.75, 1.00, "%", False),
        ("30Y yield", "yield_30y", 5.25, 5.50, "%", False),
        ("Fed hike probability", "fed_hike_prob", 0.30, 0.50, "", False),
    ]

    for metric, field, warning, critical, unit, below in checks:
        value = to_number(readings.get(field))
        if value is None or value <= 0:
            continue
        alert = threshold_alert(metric, value, warning, critical, unit, below)
        if alert:
            alerts.append(alert)

    generic_ballot = parse_generic_ballot(readings.get("generic_ballot"))
    if generic_ballot is not None and generic_ballot > 0:
        alert = threshold_alert("Generic ballot", generic_ballot, 7, 12, "", False)
        if alert:
            alerts.append(alert)

    return alerts


def normalize_scenarios(entry: dict) -> dict:
    scenarios = entry.get("scenarios") or {}
    normalized = {}
    for key in ("s1", "s2", "s3"):
        scenario = scenarios.get(key) or {}
        normalized[key] = {
            "direction": scenario.get("direction") or "stable",
            "key_signal": scenario.get("key_signal") or "",
        }
    return normalized


def canonicalize_entry(entry: dict) -> dict:
    """Keep the Worker payload shape compatible with docs/output_schemas.md."""
    result = dict(entry)
    result.setdefault("readings", {})
    result["scenario_probs"] = normalize_scenario_probabilities(result)
    result["scenarios"] = normalize_scenarios(result)
    result["threshold_alerts"] = build_threshold_alerts(result["readings"])
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

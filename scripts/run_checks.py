#!/usr/bin/env python3
"""Run local regression checks for the pivot framework."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


CHECKS = [
    [
        sys.executable,
        "-m",
        "py_compile",
        "scripts/generate_reports.py",
        "scripts/sync_worker_history.py",
        "scripts/refresh_and_sync.py",
        "scripts/run_checks.py",
        "tests/test_sync_worker_history.py",
        "tests/test_generate_reports.py",
        "tests/test_refresh_and_sync.py",
    ],
    [
        sys.executable,
        "-m",
        "unittest",
        "tests.test_sync_worker_history",
        "tests.test_generate_reports",
        "tests.test_refresh_and_sync",
    ],
    ["node", "--check", "cloudflare/src/worker.js"],
    ["node", "tests/test_worker_helpers.mjs"],
]


def main() -> int:
    for command in CHECKS:
        print("$ " + " ".join(command), flush=True)
        subprocess.run(command, cwd=ROOT, check=True)
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

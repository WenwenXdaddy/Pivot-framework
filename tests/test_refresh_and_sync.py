import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "refresh_and_sync.py"


class RefreshAndSyncTests(unittest.TestCase):
    def run_script(self, *args):
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=15,
        )

    def test_help_is_available(self):
        result = self.run_script("--help")

        self.assertEqual(result.returncode, 0)
        self.assertIn("--yes", result.stdout)
        self.assertIn("--skip-refresh", result.stdout)

    def test_refuses_refresh_without_yes(self):
        result = self.run_script()

        self.assertEqual(result.returncode, 2)
        self.assertIn("Refusing to call /api/refresh without --yes", result.stderr)


if __name__ == "__main__":
    unittest.main()

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import sync_worker_history as sync  # noqa: E402


class SyncWorkerHistoryTests(unittest.TestCase):
    def test_canonicalize_legacy_worker_entry(self):
        entry = {
            "date": "2026-05-21",
            "readings": {
                "gop_approval": 76,
                "generic_ballot": "D+9",
                "wti": 101.93,
                "gas_price": 4.56,
                "yield_10y": 4.59,
                "yield_30y": 5.20,
                "spread_2s10s": 0.85,
                "fed_hike_prob": 0.53,
            },
            "scenarios": {
                "s1": {
                    "name": "No pivot",
                    "prob": 0.15,
                    "direction": "weakening",
                    "key_signal": "S1 signal",
                },
                "s2": {
                    "name": "Tariff rollback",
                    "prob": 0.45,
                    "direction": "strengthening",
                    "key_signal": "S2 signal",
                },
                "s3": {
                    "name": "Oil trap",
                    "prob": 0.40,
                    "direction": "strengthening",
                    "key_signal": "S3 signal",
                },
            },
            "threshold_alerts": ["WTI above $100 (warning)"],
        }

        canonical = sync.canonicalize_entry(entry)

        self.assertEqual(
            canonical["scenario_probs"],
            {
                "s1_no_pivot": 0.15,
                "s2_tariff_rollback": 0.45,
                "s3_oil_trap": 0.40,
            },
        )
        self.assertEqual(canonical["scenarios"]["s1"], {"direction": "weakening", "key_signal": "S1 signal"})
        for scenario in canonical["scenarios"].values():
            self.assertNotIn("name", scenario)
            self.assertNotIn("prob", scenario)

        alerts = canonical["threshold_alerts"]
        self.assertTrue(alerts)
        self.assertTrue(all(a.startswith(("WARNING:", "CRITICAL:")) for a in alerts))
        self.assertIn("WARNING: GOP approval (76.00%) crossed warning threshold", alerts)
        self.assertIn("WARNING: Generic ballot (9) crossed warning threshold", alerts)
        self.assertIn("CRITICAL: Fed hike probability (0.53) crossed critical threshold", alerts)
        self.assertFalse(any("30Y yield" in a for a in alerts), "30Y at 5.20 should not cross 5.25 warning")

    def test_probability_normalization_fills_missing_and_sums_to_one(self):
        entry = {
            "scenario_probs": {"s1_no_pivot": "25%"},
            "scenarios": {"s2": {"prob": 0.50}},
        }

        probs = sync.normalize_scenario_probabilities(entry)

        self.assertEqual(probs["s1_no_pivot"], 0.25)
        self.assertEqual(probs["s2_tariff_rollback"], 0.50)
        self.assertAlmostEqual(sum(probs.values()), 1.0, places=4)
        self.assertEqual(probs["s3_oil_trap"], 0.25)

    def test_merge_preserves_weekly_log_wrapper(self):
        original = {"entries": [{"date": "2026-03-30", "readings": {}}], "meta": "keep"}
        worker_entries = [
            {
                "date": "2026-05-21",
                "readings": {},
                "scenarios": {
                    "s1": {"prob": 0.2},
                    "s2": {"prob": 0.5},
                    "s3": {"prob": 0.3},
                },
            }
        ]

        merged, added, updated = sync.merge_by_date(original["entries"], worker_entries)
        wrapped = sync.apply_entries_to_history(original, merged)

        self.assertEqual(added, 1)
        self.assertEqual(updated, 0)
        self.assertEqual(wrapped["meta"], "keep")
        self.assertEqual(len(wrapped["entries"]), 2)
        self.assertEqual(wrapped["entries"][-1]["scenario_probs"]["s2_tariff_rollback"], 0.5)


if __name__ == "__main__":
    unittest.main()

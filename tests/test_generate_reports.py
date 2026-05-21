import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import generate_reports as reports  # noqa: E402


class GenerateReportsTests(unittest.TestCase):
    def test_get_scenario_prob_prefers_canonical_values(self):
        entry = {
            "scenario_probs": {"s1_no_pivot": 0.15},
            "scenarios": {"s1": {"prob": 0.90}},
        }

        self.assertEqual(reports.get_scenario_prob(entry, "s1"), 0.15)

    def test_get_scenario_prob_falls_back_to_legacy_scenario_prob(self):
        entry = {
            "scenarios": {
                "s1": {"prob": 15},
                "s2": {"prob": "45%"},
                "s3": {"prob": 0.40},
            }
        }

        self.assertEqual(reports.get_scenario_prob(entry, "s1"), 0.15)
        self.assertEqual(reports.get_scenario_prob(entry, "s2"), 0.45)
        self.assertEqual(reports.get_scenario_prob(entry, "s3"), 0.40)

    def test_recompute_derived_readings_calculates_spread_and_erp(self):
        readings = {
            "yield_10y": 4.598,
            "yield_2y": 3.75,
            "yield_30y": 5.12,
            "sp500_forward_pe": 18.5,
        }

        result = reports.recompute_derived_readings(readings)

        self.assertEqual(result["spread_2s10s"], 0.85)
        self.assertEqual(result["erp"], 0.81)
        self.assertEqual(result["yield_30y"], 5.12)

    def test_recompute_derived_readings_preserves_existing_values(self):
        readings = {
            "yield_10y": 4.67,
            "yield_2y": 4.09,
            "sp500_forward_pe": 24,
            "spread_2s10s": 0.99,
            "erp": -0.12,
        }

        result = reports.recompute_derived_readings(readings)

        self.assertEqual(result["spread_2s10s"], 0.99)
        self.assertEqual(result["erp"], -0.12)

    def test_probability_formatting_accepts_fraction_or_percent(self):
        self.assertEqual(reports.fmt_prob(0.45), "45%")
        self.assertEqual(reports.fmt_prob(45), "45%")
        self.assertEqual(reports.fmt_prob("45%"), "45%")
        self.assertEqual(reports.fmt_prob(None), "&mdash;")


if __name__ == "__main__":
    unittest.main()

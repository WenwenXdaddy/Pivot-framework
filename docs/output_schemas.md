# Output Schemas

## Weekly log JSON entry format

Each entry appended to `data/weekly_log.json` must follow this exact structure:

```json
{
  "date": "2026-MM-DD",
  "readings": {
    "econ_approval": 29,
    "gop_approval": 82,
    "generic_ballot": "D+9",
    "overall_approval": 36,
    "silver_bulletin_net": -21.3,
    "vix": 31,
    "gold": 4493,
    "wti": 101,
    "brent": 115,
    "gas_price": 3.98,
    "yield_10y": 4.67,
    "yield_2y": 4.09,
    "yield_30y": 5.20,
    "spread_2s10s": 0.58,
    "fed_hike_prob": 0.40,
    "fed_cut_prob": 0.00,
    "sp500_forward_pe": 24.0,
    "erp": -0.47,
    "iran_status": "Iran rejected 15-point plan. Houthis attacked Israel. No direct talks."
  },
  "scenario_probs": {
    "s1_no_pivot": 0.30,
    "s2_tariff_rollback": 0.40,
    "s3_oil_trap": 0.30
  },
  "scenarios": {
    "s1": {
      "direction": "strengthening",
      "key_signal": "One sentence explaining the key development for this scenario."
    },
    "s2": {
      "direction": "stable",
      "key_signal": "One sentence."
    },
    "s3": {
      "direction": "weakening",
      "key_signal": "One sentence."
    }
  },
  "threshold_alerts": [
    "CRITICAL: Econ approval (29%) below Biden all-time low (32%)",
    "WARNING: 10Y yield (4.67%) crossed 4.60% ERP compression warning zone"
  ],
  "headline": "One sentence: what changed most since last entry.",
  "positioning_update": "2-3 sentences: what to do differently this week based on the data shift.",
  "elaborations": {
    "s1": "<p><b>HTML-formatted elaboration text.</b></p><p>Second paragraph.</p>",
    "s2": "<p>Elaboration for scenario 2.</p>",
    "s3": "<p>Elaboration for scenario 3.</p>"
  },
  "notes": "Freeform notes on key developments."
}
```

### Field rules
- `scenario_probs`: all three MUST sum to 1.0
- `scenarios.*.direction`: must be one of `"strengthening"`, `"weakening"`, `"stable"`
- `threshold_alerts`: only include alerts for thresholds actually crossed (see framework.md)
- `elaborations`: object with keys `s1`, `s2`, `s3`. Value is HTML-formatted string or empty string. Can be `{}` if no elaborations were written.
- All number fields are numbers (not strings). `generic_ballot` is a string like `"D+9"`.
- **Yield fields:** `yield_10y`, `yield_2y`, `yield_30y` are in percentage points (e.g., 4.67 not 0.0467). `spread_2s10s` is in percentage points (e.g., 0.58 for +58bp). `fed_hike_prob` and `fed_cut_prob` are 0-1 probabilities. `sp500_forward_pe` is a numeric multiple (e.g., 24.0). `erp` is the equity risk premium in percentage points (earnings yield minus 10Y, can be negative).
- **ERP calculation:** Compute ERP deterministically: `erp = (1 / sp500_forward_pe) * 100 - yield_10y`. If forward P/E is ~24, earnings yield is ~4.17%, and 10Y is 4.67%, then ERP = 4.17 - 4.67 = -0.50. Record as -0.50. Do not estimate ERP separately if the inputs are available.

## Elaboration text formatting

Elaborations are stored as **HTML-formatted strings** in the JSON.

### Rules
- Use `<p>` tags for paragraphs. Each analytical point is one `<p>`.
- Use `<b>` for bold text (section labels, key terms).
- Do NOT use markdown formatting (no `**`, no `##`, no `-` bullets).
- Do NOT use `<br>` between paragraphs — let `<p>` tags handle spacing.
- Do NOT use `<h2>` or `<h3>`.
- Keep each `<p>` to 2-4 sentences for readability.

## Obsidian note format

Output to `output/weekly_note.md`:

```yaml
---
type: weekly-tracker
tags:
  - macro/approval-rating
  - macro/tariff-policy
  - macro/stagflation
  - macro/rates
date: {{date}}
econ_approval: {{readings.econ_approval}}
gop_approval: {{readings.gop_approval}}
generic_ballot: "{{readings.generic_ballot}}"
vix: {{readings.vix}}
gold: {{readings.gold}}
wti: {{readings.wti}}
gas_price: {{readings.gas_price}}
yield_10y: {{readings.yield_10y}}
yield_2y: {{readings.yield_2y}}
yield_30y: {{readings.yield_30y}}
spread_2s10s: {{readings.spread_2s10s}}
fed_hike_prob: {{readings.fed_hike_prob}}
sp500_forward_pe: {{readings.sp500_forward_pe}}
erp: {{readings.erp}}
scenario_1_prob: {{scenario_probs.s1_no_pivot}}
scenario_2_prob: {{scenario_probs.s2_tariff_rollback}}
scenario_3_prob: {{scenario_probs.s3_oil_trap}}
---

# Pivot Framework — {{date}}

## Headline
{{headline}}

## Positioning update
{{positioning_update}}

## Threshold alerts
{{threshold_alerts as bullet list}}

## Key readings
- Econ approval: {{econ_approval}}%
- GOP approval: {{gop_approval}}%
- 10Y yield: {{yield_10y}}%
- 2s10s spread: {{spread_2s10s * 100}}bp
- ERP: {{erp}}%
- VIX: {{vix}}
- Gold: ${{gold}}
- WTI: ${{wti}}
- Gas: ${{gas_price}}

## Scenario probabilities
- S1 No pivot: {{s1_prob}}% ({{s1_direction}})
- S2 Tariff rollback: {{s2_prob}}% ({{s2_direction}})
- S3 Oil trap: {{s3_prob}}% ({{s3_direction}})

## Notes
{{notes}}
```

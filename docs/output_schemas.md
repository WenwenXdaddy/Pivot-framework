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
    "wti": 94,
    "brent": 104,
    "gas_price": 4.00,
    "iran_status": "15-point plan on table. Hormuz partially closed."
  },
  "scenario_probs": {
    "s1_no_pivot": 0.25,
    "s2_tariff_rollback": 0.45,
    "s3_oil_trap": 0.30
  },
  "scenarios": {
    "s1": {
      "direction": "stable",
      "key_signal": "One sentence explaining the key development for this scenario."
    },
    "s2": {
      "direction": "strengthening",
      "key_signal": "One sentence."
    },
    "s3": {
      "direction": "weakening",
      "key_signal": "One sentence."
    }
  },
  "threshold_alerts": [
    "CRITICAL: Econ approval (29%) below Biden all-time low (32%)",
    "WARNING: VIX (31) above 30 threshold"
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

## Elaboration text formatting

Elaborations are stored as **HTML-formatted strings** in the JSON. This is critical because:
- The HTML dashboard renders them directly via `innerHTML`
- The PDF generator parses the HTML tags

### Rules
- Use `<p>` tags for paragraphs. Each analytical point is one `<p>`.
- Use `<b>` for bold text (section labels, key terms).
- Do NOT use markdown formatting (no `**`, no `##`, no `-` bullets).
- Do NOT use `<br>` between paragraphs — let `<p>` tags handle spacing.
- Do NOT use `<h2>` or `<h3>` — the section headings are defined by the elaboration template in the scenario file.
- Keep each `<p>` to 2-4 sentences for readability.

### Example
```json
"elaborations": {
  "s1": "<p><b>Premise and current conditions.</b> Economic approval sits at 29%, below Biden's all-time low of 32%. GOP approval has fallen to 82%, down from 88% three weeks ago, but remains above the 80% defection danger zone.</p><p><b>Rates — curve steepener.</b> The Fed is trapped: cannot cut due to tariff-driven inflation at 3.6% core PPI, cannot hike due to softening labor data. The long end is repricing higher as the SCOTUS tariff ruling implies greater Treasury issuance to cover lost tariff revenue.</p>"
}
```

## Obsidian note format

Output to `output/weekly_note.md`:

```yaml
---
type: weekly-tracker
tags:
  - macro/approval-rating
  - macro/tariff-policy
  - macro/stagflation
date: {{date}}
econ_approval: {{readings.econ_approval}}
gop_approval: {{readings.gop_approval}}
generic_ballot: "{{readings.generic_ballot}}"
vix: {{readings.vix}}
gold: {{readings.gold}}
wti: {{readings.wti}}
gas_price: {{readings.gas_price}}
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

## Scenario probabilities
- S1 No pivot: {{s1_prob}}% ({{s1_direction}})
- S2 Tariff rollback: {{s2_prob}}% ({{s2_direction}})
- S3 Oil trap: {{s3_prob}}% ({{s3_direction}})

## Notes
{{notes}}

## Iran status
{{readings.iran_status}}
```

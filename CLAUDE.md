# Trump Economic Approval → Policy Pivot Framework

Track economic approval ratings as leading indicators for policy pivots. Three scenarios map political dynamics to market positioning.

## Commands

### `update`
Quick refresh (~3 min). Collects latest data, re-evaluates scenarios, generates reports.

1. Read `docs/data_sources.md` — contains all search queries to run
2. Execute every web search listed there. Do not skip any.
3. Read `docs/framework.md` — contains thresholds and probability rubric
4. Read all three files in `docs/scenarios/` — contains strengthen/weaken conditions
5. Re-evaluate scenario probabilities using the rubric in framework.md
6. Read `docs/output_schemas.md` — contains the exact JSON format
7. Read `data/weekly_log.json`, append a new entry in the specified format (with empty `elaborations: {}`)
8. Write the updated JSON back to `data/weekly_log.json`
9. Run: `pip install reportlab --break-system-packages -q 2>/dev/null && python3 scripts/generate_reports.py`
10. Print summary: what changed, which scenario shifted, any threshold crossings

### `update and elaborate`
Comprehensive report (~12 min). Full update PLUS deep-dive on all three scenarios.

1. Do steps 1-6 of `update` above
2. For EACH scenario (s1, s2, s3):
   a. Re-read that scenario's file in `docs/scenarios/`
   b. Run the additional search queries listed in that file's "Elaboration searches" section
   c. Write the elaboration following that file's "Elaboration template" — this defines the exact structure and depth expected
   d. Store the elaboration as an HTML-formatted string (use `<p>` tags for paragraphs, `<b>` for bold) in the JSON entry's `elaborations` field
3. Read `docs/output_schemas.md` for the JSON format
4. Write the complete entry (readings + probs + elaborations) to `data/weekly_log.json`
5. Run: `pip install reportlab --break-system-packages -q 2>/dev/null && python3 scripts/generate_reports.py`
6. Print summary

### `elaborate [scenario]`
Deep-dive on one scenario. Reads only the relevant scenario file.

1. Read `docs/scenarios/s{N}_{name}.md`
2. Run its "Elaboration searches"
3. Write elaboration following the file's "Elaboration template"
4. Read `data/weekly_log.json`, update the latest entry's `elaborations.s{N}` field with HTML-formatted text
5. Write back to `data/weekly_log.json`
6. Run: `python3 scripts/generate_reports.py`

### `report`
Regenerate outputs from existing data. No web searches.
Run: `python3 scripts/generate_reports.py`

### `log`
Read `data/weekly_log.json`. Display trend of key readings across last 4-5 entries. Highlight threshold crossings and scenario probability shifts.

### `obsidian`
Read latest entry from `data/weekly_log.json`. Read `docs/output_schemas.md` for the Obsidian YAML format. Write note to `output/weekly_note.md`.

## File map
| File | Purpose | Read when |
|------|---------|-----------|
| `docs/framework.md` | Thresholds, transmission mechanism, probability rubric | `update`, `update and elaborate` |
| `docs/scenarios/s1_no_pivot.md` | S1 conditions, positioning, elaboration template | `update`, `elaborate s1` |
| `docs/scenarios/s2_tariff_rollback.md` | S2 conditions, positioning, elaboration template | `update`, `elaborate s2` |
| `docs/scenarios/s3_oil_trap.md` | S3 conditions, positioning, elaboration template | `update`, `elaborate s3` |
| `docs/data_sources.md` | All search queries and polling sources | `update` |
| `docs/output_schemas.md` | JSON, HTML, PDF, Obsidian format specs | `update`, `obsidian` |
| `scripts/generate_reports.py` | Reads weekly_log.json, outputs HTML + PDF | `report`, after any update |
| `data/weekly_log.json` | Historical data store | All commands |

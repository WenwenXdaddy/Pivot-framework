# Yield Channel Integration Plan v2 Final

## Goal

Integrate a second transmission channel into the Pivot Framework:

- Channel 1: Gas price -> approval -> GOP defections -> policy pivot
- Channel 2: Yields -> mortgage/borrowing costs -> affordability pain -> GOP defections -> policy pivot

The integration must cover docs, historical data, local report generation, Cloudflare Worker refresh logic, the live frontend dashboard, and the static dashboard template. It must preserve the existing Chinese localization, language toggle, and elaboration caching work in the Cloudflare files.

## Pre-flight

`cloudflare/src/worker.js` and `cloudflare/public/index.html` currently have uncommitted localization and elaboration-caching changes. Before any agent work begins, commit those files on `main`.

Commit message:

```text
Add Chinese localization, elaboration caching, and language toggle to Cloudflare dashboard
```

Agent B must branch or worktree from the post-preflight commit that contains those Cloudflare changes.

## Data Contract

Keep the existing dual-track schema. Do not unify the local and Worker shapes in this integration.

Local `data/weekly_log.json`:

```json
{
  "scenario_probs": {
    "s1_no_pivot": 0.30,
    "s2_tariff_rollback": 0.45,
    "s3_oil_trap": 0.25
  },
  "scenarios": {
    "s1": { "direction": "strengthening", "key_signal": "..." }
  }
}
```

Worker API:

```json
{
  "scenarios": {
    "s1": { "name": "No pivot", "prob": 0.30, "direction": "strengthening", "key_signal": "..." }
  }
}
```

Both systems must add the same yield fields inside `readings`:

```json
{
  "yield_10y": 4.67,
  "yield_2y": 4.09,
  "yield_30y": 5.20,
  "spread_2s10s": 0.58,
  "fed_hike_prob": 0.40,
  "fed_cut_prob": 0.00,
  "sp500_forward_pe": 24.0,
  "erp": -0.50
}
```

Field units:

- `yield_10y`, `yield_2y`, `yield_30y`: percentage points, not decimals.
- `spread_2s10s`: percentage points, e.g. `0.58` means `+58bp`.
- `fed_hike_prob`, `fed_cut_prob`: probabilities from 0 to 1.
- `sp500_forward_pe`: numeric multiple, e.g. `24.0`.
- `erp`: percentage points.

ERP must be computed deterministically:

```text
erp = (1 / sp500_forward_pe) * 100 - yield_10y
```

The zero-ERP 10Y level is dynamic:

```text
erp_zero_yield = (1 / sp500_forward_pe) * 100
```

Do not describe 4.75% as a fixed ERP-zero threshold. Describe it as a warning zone where ERP is likely compressed or inverted depending on current forward P/E.

## Agent A: Docs, Data, Project Descriptions

Agent A is the main agent. It owns the data contract, docs consistency, and final handoff notes for integration.

Files owned by Agent A:

- `docs/framework.md`
- `docs/data_sources.md`
- `docs/output_schemas.md`
- `docs/scenarios/s1_no_pivot.md`
- `docs/scenarios/s2_tariff_rollback.md`
- `docs/scenarios/s3_oil_trap.md`
- `data/weekly_log.json`
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`

Agent A must not modify Cloudflare files, report scripts, or templates.

Tasks:

1. Copy the six finalized docs from `yield-update/docs/` to `docs/`.
2. Ensure `docs/data_sources.md` has 16 required searches, including S&P 500 forward P/E:
   - `S&P 500 12 month forward P/E FactSet latest`
3. Ensure `docs/output_schemas.md` documents `sp500_forward_pe` and deterministic ERP calculation.
4. Backfill `data/weekly_log.json` with yield fields.
5. Update `CLAUDE.md`, `AGENTS.md`, and `README.md` to describe the dual-channel framework.

Backfill values:

`2026-03-28`:

```json
{
  "yield_10y": 4.43,
  "yield_2y": 3.92,
  "yield_30y": 4.82,
  "spread_2s10s": 0.51,
  "fed_hike_prob": 0.08,
  "fed_cut_prob": 0.25,
  "sp500_forward_pe": 21.0,
  "erp": 0.33
}
```

ERP check: `(1 / 21.0) * 100 - 4.43 = 0.33`.

`2026-03-30`:

```json
{
  "yield_10y": 4.35,
  "yield_2y": 3.88,
  "yield_30y": 4.78,
  "spread_2s10s": 0.47,
  "fed_hike_prob": 0.08,
  "fed_cut_prob": 0.28,
  "sp500_forward_pe": 20.8,
  "erp": 0.46
}
```

ERP check: `(1 / 20.8) * 100 - 4.35 = 0.46`.

## Agent B: Code, Cloudflare, Frontend

Files owned by Agent B:

- `scripts/generate_reports.py`
- `cloudflare/src/worker.js`
- `cloudflare/public/index.html`
- `templates/dashboard_template.html`

Agent B must not modify docs, `data/weekly_log.json`, `CLAUDE.md`, `AGENTS.md`, or `README.md`.

Tasks:

1. Add formatting helpers and defensive ERP recalculation to `scripts/generate_reports.py`.
2. Add yield rows and yield charts to local HTML output.
3. Add yield context to PDF output.
4. Update Worker prompt, search queries, post-processing, and scenario elaboration prompts.
5. Preserve existing Chinese localization and `/api/elaboration/:n` caching.
6. Add yield cards, Fed hike probability card, i18n labels, and history charts to `cloudflare/public/index.html`.
7. Update `templates/dashboard_template.html` with dual-channel mechanism and yield-aware scenario content.

Worker post-processing must coerce numeric fields before computing derived values. A helper like this is acceptable:

```js
function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%,$,+bp\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
```

After extraction:

```js
const r = parsed.readings || {};
r.yield_10y = toNumber(r.yield_10y);
r.yield_2y = toNumber(r.yield_2y);
r.yield_30y = toNumber(r.yield_30y);
r.fed_hike_prob = normalizeProbability(r.fed_hike_prob);
r.fed_cut_prob = normalizeProbability(r.fed_cut_prob);
r.sp500_forward_pe = toNumber(r.sp500_forward_pe);

if (r.yield_10y != null && r.yield_2y != null) {
  r.spread_2s10s = Math.round((r.yield_10y - r.yield_2y) * 100) / 100;
}
if (r.yield_10y != null && r.sp500_forward_pe) {
  r.erp = Math.round(((1 / r.sp500_forward_pe) * 100 - r.yield_10y) * 100) / 100;
}
```

`normalizeProbability` should convert `40`, `"40%"`, or `0.40` into `0.40`.

`generate_reports.py` should write HTML with explicit UTF-8:

```python
with open(HTML_OUT, "w", encoding="utf-8") as f:
    f.write(html)
```

## Execution Order

1. Pre-flight commit of current Cloudflare changes on `main`.
2. Start Agent A and Agent B from the post-preflight base.
3. Agent A completes docs/data/project descriptions and records final data-contract notes.
4. Agent B completes code/frontend/template changes.
5. Merge Agent A first, then Agent B.
6. Run verification.

## Verification Checklist

Data integrity:

- `data/weekly_log.json` entries have numeric yield fields.
- `2026-03-28` ERP is `0.33`.
- `2026-03-30` ERP is `0.46`.
- `docs/data_sources.md` has 16 required searches.
- `docs/output_schemas.md` documents `sp500_forward_pe` and deterministic ERP.

Local reports:

- `python scripts/generate_reports.py` runs without error.
- `output/latest.html` shows yield/rates cards and 10Y/ERP charts.
- `output/report.pdf` includes yield/rates context.
- Missing yield fields render as fallback values, not crashes.

Cloudflare Worker:

- `SYSTEM_PROMPT` includes Channel 2, yield thresholds, and yield JSON fields.
- Refresh searches include 10Y, 2Y, 30Y, CME FedWatch, and forward P/E.
- ERP is computed post-hoc, not model-estimated.
- `spread_2s10s` is computed from 10Y minus 2Y when possible.
- Chinese localization still works.
- `/api/elaboration/:n` caching still works.

Frontend:

- Yield/rates row renders 10Y, 2s10s, 30Y, ERP, and Fed hike probability.
- Chinese labels include rates/yield terms.
- History charts include 10Y and ERP.
- Missing fields in older history entries do not break charts.

Static template:

- Overview shows dual-channel transmission mechanism.
- Yield gauges appear in current readings.
- S1, S2, and S3 sections include yield-aware content.

Project docs:

- `CLAUDE.md`, `AGENTS.md`, and `README.md` mention the dual-channel framework.

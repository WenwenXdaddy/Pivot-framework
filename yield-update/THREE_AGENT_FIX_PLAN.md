# Three-Agent Fix Plan: Worker Search, Schema, Thresholds, Frontend

## Purpose

This plan coordinates three parallel agents to repair the current production path for the pivot framework. The immediate goal is to make the Cloudflare Worker refresh path faithful to the documented framework, while keeping the frontend and local reporting path compatible.

The three highest-priority outcomes are:

1. `doRefresh()` runs every required search listed in `docs/data_sources.md`.
2. Worker output converges on the JSON contract in `docs/output_schemas.md`.
3. Threshold alerts are generated deterministically from `docs/framework.md`, not left to the model.

## Shared Contract

All agents must treat the following entry shape as the target canonical data contract:

```json
{
  "date": "YYYY-MM-DD",
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
    "yield_30y": 5.2,
    "spread_2s10s": 0.58,
    "fed_hike_prob": 0.4,
    "fed_cut_prob": 0,
    "sp500_forward_pe": 24,
    "erp": -0.5,
    "iran_status": "Short status summary."
  },
  "scenario_probs": {
    "s1_no_pivot": 0.3,
    "s2_tariff_rollback": 0.4,
    "s3_oil_trap": 0.3
  },
  "scenarios": {
    "s1": { "direction": "strengthening", "key_signal": "One sentence." },
    "s2": { "direction": "stable", "key_signal": "One sentence." },
    "s3": { "direction": "weakening", "key_signal": "One sentence." }
  },
  "threshold_alerts": [
    "WARNING: 10Y yield (4.67%) crossed warning threshold"
  ],
  "headline": "One sentence.",
  "positioning_update": "Two to three sentences.",
  "elaborations": {},
  "notes": "Freeform notes."
}
```

The frontend may support the old Worker shape as a fallback, but new Worker refresh output must use this contract.

## Agent A: Worker Search and Schema Contract

### Ownership

Primary file:

- `cloudflare/src/worker.js`

Read-only references:

- `docs/data_sources.md`
- `docs/output_schemas.md`
- `docs/framework.md`

### Tasks

1. Replace the current 11-query refresh list with the full 16 required searches from `docs/data_sources.md`.
2. Keep query wording close to the docs so future drift is obvious.
3. Update `SYSTEM_PROMPT` so the model is asked for the canonical `output_schemas.md` structure.
4. Add or update schema normalization so the Worker can:
   - accept new canonical output,
   - migrate old `scenarios.sN.prob` into `scenario_probs`,
   - remove `name` fields from canonical `scenarios` output if present,
   - always provide `notes` and `elaborations`.
5. Fix `/api/provider` so it no longer reports a misleading hard-coded `hasSearch: true`.
6. Leave threshold values and alert generation to Agent B, but expose a clean postprocess point where Agent B can call deterministic alert and probability helpers.

### Acceptance

- `doRefresh()` covers all 16 required metrics.
- Worker refresh response contains top-level `scenario_probs`.
- Worker refresh response still does not break old KV history consumers.
- Provider info distinguishes model-native search from Tavily prefetch search.

## Agent B: Thresholds, Alerts, and Probability Integrity

### Ownership

Primary file:

- `cloudflare/src/worker.js`

Read-only references:

- `docs/framework.md`
- `docs/output_schemas.md`

### Tasks

1. Implement deterministic threshold generation, preferably with pure helpers:
   - `buildThresholdAlerts(readings)`
   - `parseGenericBallot(value)`
   - any formatting helpers needed for clean output.
2. Align thresholds exactly with `docs/framework.md`:
   - Econ approval: warning `< 30`, critical `< 25`
   - GOP approval: warning `< 80`, critical `< 75`
   - Generic ballot: warning `D+7`, critical `D+12`
   - VIX: warning `> 30`, critical `> 40`
   - WTI: warning `> 100`, critical `> 120`
   - Gas price: warning `> 4.00`, critical `> 5.00`
   - 10Y yield: warning `> 4.60`, critical `> 5.00`
   - 2s10s spread: warning `> 0.75`, critical `> 1.00`
   - 30Y yield: warning `> 5.25`, critical `> 5.50`
   - Fed hike probability: warning `> 0.30`, critical `> 0.50`
3. Ensure every threshold alert starts with `WARNING:` or `CRITICAL:`.
4. Prefer program-generated threshold alerts over model-generated alerts.
5. Normalize scenario probabilities:
   - pull from canonical `scenario_probs` first,
   - fallback to old `scenarios.sN.prob`,
   - ensure all three probabilities are numbers,
   - ensure the final sum is `1.0` after rounding.
6. Add lightweight local test scaffolding or documented sample checks if feasible without overbuilding.

### Acceptance

- GOP approval at `76` generates a `WARNING:` alert.
- GOP approval below `75` generates a `CRITICAL:` alert.
- 10Y at `4.67` generates warning.
- 30Y at `5.20` does not generate warning.
- 30Y at `5.26` generates warning.
- Fed hike probability at `0.40` generates warning, not critical.
- Alert generation does not depend on LLM wording.

## Agent C: Frontend, Local Reports, and Documentation

### Ownership

Primary files:

- `cloudflare/public/index.html`
- `scripts/generate_reports.py`
- `README.md`
- `.gitignore` if needed

Read-only references:

- `docs/output_schemas.md`
- `data/weekly_log.json`
- `cloudflare/src/worker.js`

### Tasks

1. Add frontend helpers for scenario probabilities:
   - prefer `data.scenario_probs.s1_no_pivot`,
   - fallback to `data.scenarios.s1.prob`,
   - repeat for S2 and S3.
2. Add the missing S3 historical probability chart:
   - chart card,
   - canvas,
   - i18n labels,
   - `drawChart('chart-s3', ...)` in `loadHistory()`.
3. Replace or reduce `zoom: 1.4` with normal responsive sizing.
4. Adapt provider info display to the new provider fields from Agent A.
5. Keep `scripts/generate_reports.py` compatible with canonical `scenario_probs`; add old Worker fallback only if it is low-risk.
6. Update README to clearly state that local `data/weekly_log.json` and Worker KV history are currently separate unless a sync/export step is implemented.
7. Propose, but do not destructively remove, old screenshot artifacts. If adding ignore rules, avoid deleting already tracked files unless the user explicitly approves.

### Acceptance

- Dashboard shows S1, S2, and S3 probability trends.
- Dashboard renders both canonical new data and old Worker-shaped history entries.
- Provider info no longer implies DeepSeek has model-native web search.
- README does not imply local reports and Worker KV are automatically synced.
- No tracked screenshot files are removed without approval.

## Coordination Rules

Use `yield-update/THREE_AGENT_SYNC_PROTOCOL.md` for status format and handoffs.

Each agent writes only its own status file:

- Agent A: `yield-update/status/agent_a_search_schema_status.md`
- Agent B: `yield-update/status/agent_b_threshold_status.md`
- Agent C: `yield-update/status/agent_c_frontend_reports_status.md`

Agents must not overwrite each other's status files.

## Integration Sequence

1. Kickoff:
   - Each agent reads this plan and its own prompt.
   - Each agent writes an initial `in_progress` checkpoint.
2. First parallel pass:
   - Agent A handles search list and schema normalization.
   - Agent B handles threshold and probability helpers.
   - Agent C handles frontend probability compatibility and S3 chart.
3. Integration checkpoint:
   - Read all three status files.
   - Resolve any overlap in `cloudflare/src/worker.js`.
   - Run `node --check cloudflare/src/worker.js`.
4. Second pass:
   - Agent A finalizes provider info and old-shape compatibility.
   - Agent B finalizes edge cases and sample checks.
   - Agent C finalizes README/reporting/zoom/provider display.
5. Final verification:
   - `node --check cloudflare/src/worker.js`
   - `node --check` is not useful for HTML, so inspect `index.html` manually and, if a dev server is used, verify in browser.
   - `python scripts/generate_reports.py` if local dependencies are available.
   - Manual alert sample checks listed under Agent B acceptance.

## Conflict Rules

- `docs/framework.md` is the threshold source of truth. Do not change thresholds as part of this fix.
- `docs/output_schemas.md` is the schema source of truth. Do not redefine the schema unless the user explicitly requests it.
- Worker may support old history shape, but the old shape must not become the canonical contract.
- Threshold alerts must be deterministic code output.
- If two agents touch the same area of `worker.js`, keep pure helpers from Agent B and let Agent A wire them into the refresh postprocess.

## Deferred Work

The following should be a later task unless there is extra time after the core fix:

- Full elaboration prompt/template rewrite using all scenario-specific templates.
- KV-to-local `weekly_log.json` sync command.
- Removing or untracking existing screenshots.
- Refactoring `templates/dashboard_template.html` beyond labeling it legacy.

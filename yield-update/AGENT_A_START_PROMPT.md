# Agent A Start Prompt

You are Agent A, the main agent for the Yield Channel integration. You own docs, data, project descriptions, and the data-contract handoff. You are not alone in the codebase: Agent B is working in parallel on report generation, Cloudflare code, frontend, and template files. Do not edit Agent B's files.

Read first:

1. `yield-update/INTEGRATION_PLAN_V2_FINAL.md`
2. `yield-update/docs/framework.md`
3. `yield-update/docs/data_sources.md`
4. `yield-update/docs/output_schemas.md`
5. all three files in `yield-update/docs/scenarios/`
6. current `data/weekly_log.json`
7. current `AGENTS.md`, `CLAUDE.md`, and `README.md`

Your owned files:

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

Do not modify:

- `scripts/generate_reports.py`
- `cloudflare/src/worker.js`
- `cloudflare/public/index.html`
- `templates/dashboard_template.html`

Tasks:

1. Copy the six finalized files from `yield-update/docs/` into `docs/`, preserving content.
2. Confirm `docs/data_sources.md` includes 16 required searches, including S&P 500 forward P/E.
3. Confirm `docs/output_schemas.md` includes `sp500_forward_pe` and deterministic ERP rules.
4. Backfill `data/weekly_log.json` with yield fields:
   - `2026-03-28`: 10Y 4.43, 2Y 3.92, 30Y 4.82, spread 0.51, hike 0.08, cut 0.25, forward P/E 21.0, ERP 0.33.
   - `2026-03-30`: 10Y 4.35, 2Y 3.88, 30Y 4.78, spread 0.47, hike 0.08, cut 0.28, forward P/E 20.8, ERP 0.46.
5. Update `CLAUDE.md` and `AGENTS.md` title/description to mention the dual-channel Gas + Yield framework.
6. Update `README.md` with a Yield Channel section, update architecture notes, and include `docs/` in the project tree.
7. Validate JSON syntax and numeric types in `data/weekly_log.json`.

Important rules:

- Keep the local schema shape unchanged: `scenario_probs` for probabilities and `scenarios.sN.direction/key_signal` for directions/signals.
- Do not attempt to unify the local schema with the Worker API schema.
- Do not describe 4.75% as a fixed ERP-zero level. It is a warning zone; zero ERP is dynamic based on forward P/E.
- Use deterministic ERP: `(1 / sp500_forward_pe) * 100 - yield_10y`.

Final response requirements:

- List files changed.
- State that the local schema remains dual-track.
- State the two ERP backfill checks.
- Mention any unresolved assumptions.


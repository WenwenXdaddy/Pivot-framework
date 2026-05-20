# Agent B Start Prompt

You are Agent B for the Yield Channel integration. You own code, Cloudflare Worker, live frontend, and static dashboard template. You are not alone in the codebase: Agent A is working in parallel on docs, data, and project descriptions. Do not edit Agent A's files.

You must start from the post-preflight commit that contains the existing Chinese localization, language toggle, and elaboration caching in:

- `cloudflare/src/worker.js`
- `cloudflare/public/index.html`

Read first:

1. `yield-update/INTEGRATION_PLAN_V2_FINAL.md`
2. `yield-update/COORDINATION.md`
3. `yield-update/SYNC_PROTOCOL.md`
4. current `scripts/generate_reports.py`
5. current `cloudflare/src/worker.js`
6. current `cloudflare/public/index.html`
7. current `templates/dashboard_template.html`

Your owned files:

- `scripts/generate_reports.py`
- `cloudflare/src/worker.js`
- `cloudflare/public/index.html`
- `templates/dashboard_template.html`

Do not modify:

- `docs/`
- `data/weekly_log.json`
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`

Tasks:

1. `scripts/generate_reports.py`
   - Add `fmt_pct`, `fmt_bp`, `fmt_prob`, and money/number-safe formatting where useful.
   - Defensively recompute `erp` if missing and `sp500_forward_pe` plus `yield_10y` exist.
   - Add a second market row for 10Y, 2s10s, 30Y, ERP, and Fed hike probability.
   - Add 10Y and ERP historical chart datasets and charts.
   - Add yield/rates context to the PDF.
   - Write HTML with explicit `encoding="utf-8"`.

2. `cloudflare/src/worker.js`
   - Preserve Chinese translation functions and `/api/elaboration/:n` caching.
   - Update `SYSTEM_PROMPT` with Channel 2, yield thresholds, and yield fields.
   - Include `yield_10y`, `yield_2y`, `yield_30y`, `spread_2s10s`, `fed_hike_prob`, `fed_cut_prob`, and `sp500_forward_pe` in the prompt schema.
   - Do not ask the LLM to return `erp`; compute it post-hoc.
   - Add refresh searches for 10Y, 2Y, 30Y, CME FedWatch, and S&P 500 forward P/E.
   - Add numeric coercion for LLM outputs before derived calculations.
   - Add `normalizeProbability` so `40`, `"40%"`, and `0.40` all become `0.40`.
   - Compute `spread_2s10s = yield_10y - yield_2y` when possible.
   - Compute `erp = (1 / sp500_forward_pe) * 100 - yield_10y`.
   - Update elaboration prompts and scenario queries with yield-aware content.

3. `cloudflare/public/index.html`
   - Add rates/yield cards for 10Y, 2s10s, 30Y, ERP, and Fed hike probability.
   - Add English and Chinese i18n keys:
     - `ratesContext`: Rates & yield / 利率与收益率
     - `yield10y`: 10Y yield / 10Y收益率
     - `spread2s10s`: 2s10s / 期限利差
     - `yield30y`: 30Y yield / 30Y收益率
     - `erp`: ERP / 股权风险溢价
     - `fedHikeProb`: Fed hike prob / 加息概率
   - Add population logic with missing-field fallbacks.
   - Add 10Y and ERP history chart cards and `drawChart` calls.

4. `templates/dashboard_template.html`
   - Replace the single transmission chain with dual channels converging at intra-GOP fracture.
   - Add yield gauges in the overview.
   - Add yield-aware S1, S2, and S3 content:
     - S1: ERP compression, bear steepener, duration rotation.
     - S2: yield-driven second catalyst, REITs/housing, yield-amplified rally.
     - S3: oil-yield divergence, yield persistence, duration/bonds nuance.

Status sync:

- Append checkpoints to `yield-update/status/agent_b_status.md` after each required task group listed in `yield-update/SYNC_PROTOCOL.md`.
- Before final verification, read `yield-update/status/agent_a_status.md` if it exists and note any unresolved blocker or assumption.
- Do not ask the user to relay routine status to Agent A; write the status file instead.

Important rules:

- Keep the Worker API schema shape unchanged: `scenarios.sN.prob` remains in the API response.
- Keep the local schema out of scope.
- Do not remove or regress existing Chinese localization, language toggle, cached elaboration retrieval, or translation behavior.
- Missing yield fields must render as fallback values rather than throwing.

Verification:

- Run `python scripts/generate_reports.py`.
- Confirm `output/latest.html` and `output/report.pdf` are generated.
- If possible, inspect frontend logic for syntax errors.

Final response requirements:

- List files changed.
- State how ERP and 2s10s are computed.
- State that Chinese localization and elaboration caching were preserved.
- Mention any verification commands run and any limitations.

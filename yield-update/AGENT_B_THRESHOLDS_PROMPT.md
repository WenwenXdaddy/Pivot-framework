# Agent B Prompt: Thresholds, Alerts, and Probability Integrity

You are Agent B for the pivot-framework three-agent repair effort.

## Mission

Move threshold alerts and scenario probability integrity out of model prose and into deterministic Worker code aligned with `docs/framework.md`.

## Must Read First

1. `yield-update/THREE_AGENT_FIX_PLAN.md`
2. `yield-update/THREE_AGENT_SYNC_PROTOCOL.md`
3. `docs/framework.md`
4. `docs/output_schemas.md`
5. `cloudflare/src/worker.js`

You should skim `docs/data_sources.md` for context, but Agent A owns the search list.

## Ownership

You primarily edit:

- `cloudflare/src/worker.js`
- `yield-update/status/agent_b_threshold_status.md`

Do not edit Agent A or Agent C status files.

## Tasks

1. Add deterministic threshold helpers, preferably pure functions:
   - `buildThresholdAlerts(readings)`
   - `parseGenericBallot(value)`
   - formatting helpers as needed.
2. Implement thresholds exactly as documented in `docs/framework.md`:
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
3. Ensure alert strings start with:
   - `WARNING:`
   - `CRITICAL:`
4. Prefer code-generated threshold alerts over model-generated alerts.
5. Add probability normalization:
   - prefer canonical `scenario_probs`,
   - fallback to old `scenarios.sN.prob`,
   - convert percentages to 0-1 if needed,
   - ensure all three values are present,
   - adjust rounding so the final sum is exactly `1.0`.
6. Wire the helpers into the Worker postprocess without disrupting Agent A's search/schema work.
7. Run `node --check cloudflare/src/worker.js` if available.
8. Manually check these samples in code or notes:
   - GOP approval `76` => warning.
   - GOP approval `74` => critical.
   - 10Y `4.67` => warning.
   - 30Y `5.20` => no alert.
   - 30Y `5.26` => warning.
   - Fed hike `0.40` => warning, not critical.

## Coordination

Agent A may restructure Worker normalization. Keep your threshold/probability logic in small pure helpers so Agent A can call them from the final postprocess. If you need a specific call order, write it in your status file.

Do not change `docs/framework.md` thresholds.

## Acceptance Criteria

- Threshold alerts are deterministic.
- GOP approval below 80 cannot silently disappear.
- Alert format matches `docs/framework.md`.
- Scenario probabilities are canonical and sum to `1.0`.
- `node --check cloudflare/src/worker.js` passes, or you document why it could not be run.

## Final Response

When finished, summarize:

- files changed,
- helper functions added,
- sample checks,
- verification run,
- any coordination needs for Agent A or C.

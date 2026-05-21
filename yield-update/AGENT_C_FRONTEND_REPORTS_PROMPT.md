# Agent C Prompt: Frontend, History Charts, Local Reports, Docs

You are Agent C for the pivot-framework three-agent repair effort.

## Mission

Make the dashboard and local reporting path compatible with the canonical Worker schema, add the missing S3 history chart, and document the local JSON versus Worker KV split.

## Must Read First

1. `yield-update/THREE_AGENT_FIX_PLAN.md`
2. `yield-update/THREE_AGENT_SYNC_PROTOCOL.md`
3. `docs/output_schemas.md`
4. `cloudflare/public/index.html`
5. `scripts/generate_reports.py`
6. `README.md`
7. `.gitignore`

Skim `cloudflare/src/worker.js` only for response shape context. Agent A and B own Worker logic.

## Ownership

You primarily edit:

- `cloudflare/public/index.html`
- `scripts/generate_reports.py`
- `README.md`
- `.gitignore` if needed
- `yield-update/status/agent_c_frontend_reports_status.md`

Do not edit Agent A or Agent B status files.

## Tasks

1. Add frontend probability helpers:
   - prefer `data.scenario_probs.s1_no_pivot`,
   - fallback to `data.scenarios.s1.prob`,
   - repeat for S2 and S3.
2. Update scenario cards to use the helper instead of assuming `scenarios.sN.prob`.
3. Update history chart extraction to use the same helper.
4. Add the missing S3 probability chart:
   - new chart card,
   - new `chart-s3` canvas,
   - English and Chinese i18n labels,
   - `drawChart('chart-s3', ...)` in `loadHistory()`.
5. Replace or reduce `.container { zoom: 1.4; }` with a more standard responsive approach.
   - Keep the visual change scoped.
   - Do not redesign the whole page.
6. Adapt provider display to Agent A's likely new fields:
   - `hasModelSearch`
   - `hasTavilySearch`
   - `searchMode`
   - keep fallback compatibility with old `hasSearch`.
7. Review `scripts/generate_reports.py`.
   - It already expects `scenario_probs`; preserve that.
   - Add old Worker fallback only if it is simple and low-risk.
8. Update `README.md` to state clearly:
   - local `data/weekly_log.json` powers local reports,
   - Worker KV powers deployed dashboard history,
   - no automatic KV-to-local sync currently exists unless implemented later.
9. Screenshot artifacts:
   - Do not delete tracked `output/*.png` files.
   - If adding ignore rules for future screenshots, make clear that already tracked files remain tracked until explicitly removed.
10. Verify syntax/behavior as much as possible.
11. Update your status file after each task group.

## Coordination

Agent A may change provider response fields. Build defensive display logic so the frontend handles both old and new provider payloads.

Agent A and B may change Worker data shape. Use helpers so the frontend supports both canonical `scenario_probs` and old `scenarios.sN.prob`.

## Acceptance Criteria

- Frontend can render canonical new data.
- Frontend still handles old history entries with `scenarios.sN.prob`.
- S3 historical probability chart is visible and drawn.
- Provider info display is accurate for Tavily-prefetched search versus model-native search.
- README clearly explains local JSON and Worker KV separation.
- No tracked screenshot files are removed.

## Final Response

When finished, summarize:

- files changed,
- frontend compatibility behavior,
- S3 chart implementation,
- README/reporting changes,
- verification run,
- any coordination needs for Agent A or B.

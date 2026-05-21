# Agent A Prompt: Worker Search and Schema Contract

You are Agent A for the pivot-framework three-agent repair effort.

## Mission

Fix the Cloudflare Worker refresh path so it collects the documented required data and emits the canonical schema from `docs/output_schemas.md`.

## Must Read First

1. `yield-update/THREE_AGENT_FIX_PLAN.md`
2. `yield-update/THREE_AGENT_SYNC_PROTOCOL.md`
3. `docs/data_sources.md`
4. `docs/output_schemas.md`
5. `cloudflare/src/worker.js`

Also skim `docs/framework.md` for context, but do not implement threshold logic yourself. Agent B owns thresholds.

## Ownership

You primarily edit:

- `cloudflare/src/worker.js`
- `yield-update/status/agent_a_search_schema_status.md`

Do not edit Agent B or Agent C status files.

## Tasks

1. Update `doRefresh()` so it runs all 16 required searches from `docs/data_sources.md`.
   - Include Overall approval, GOP approval, Silver Bulletin, Iran status, and Tariffs.
   - Keep query wording close to the docs.
   - Make sure oil coverage extracts both WTI and Brent.
2. Update `SYSTEM_PROMPT` to request the canonical JSON shape:
   - top-level `scenario_probs`
   - `scenarios.s1/s2/s3` with only `direction` and `key_signal`
   - `threshold_alerts`
   - `headline`
   - `positioning_update`
   - `elaborations`
   - `notes`
3. Add or adjust schema normalization after model parsing:
   - If `scenario_probs` is missing but old `scenarios.sN.prob` exists, populate `scenario_probs`.
   - If canonical `scenario_probs` exists, keep it.
   - Ensure `elaborations` exists, defaulting to `{}`.
   - Ensure `notes` exists, defaulting to an empty string.
   - Remove or ignore scenario `name` and `prob` in canonical output.
4. Add a clean postprocess call point for Agent B's deterministic threshold and probability helpers.
5. Fix `/api/provider` so it does not hard-code misleading search capability.
   - Recommended shape: `hasModelSearch`, `hasTavilySearch`, and optionally a short `searchMode`.
6. Run `node --check cloudflare/src/worker.js` if available.
7. Update your status file after each task group.

## Coordination

Agent B may also edit `cloudflare/src/worker.js`. If you see threshold/probability helpers from Agent B, preserve them and wire your normalization around them. Do not overwrite Agent B's pure helpers.

Agent C depends on the final Worker shape. If you change any public response field, write it under `Public interfaces changed` in your status file.

## Acceptance Criteria

- `doRefresh()` includes all 16 documented searches.
- Refresh output has top-level `scenario_probs`.
- Refresh output includes `notes` and `elaborations`.
- Old Worker-shaped model output can still be normalized.
- Provider info distinguishes model-native search from Tavily prefetch.
- `node --check cloudflare/src/worker.js` passes, or you document why it could not be run.

## Final Response

When finished, summarize:

- files changed,
- searches added,
- schema compatibility behavior,
- verification run,
- any coordination needs for Agent B or C.

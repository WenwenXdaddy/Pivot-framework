# Phase 2B Plan: Local/Worker Data Alignment and Elaboration Templates

## Purpose

Phase 2B finishes the work intentionally deferred from the three-agent repair. The previous phase fixed the production-critical Worker path: complete required searches, canonical schema, deterministic threshold alerts, and frontend compatibility. This phase closes the remaining operational gaps:

1. Make docs and agent instructions explicit about local `weekly_log.json` versus deployed Worker KV.
2. Decide and implement a practical Worker KV to local JSON sync/export path, or explicitly mark the local path as legacy/demo.
3. Wire elaboration generation to the scenario-specific searches and templates in `docs/scenarios/`.
4. Mark `templates/dashboard_template.html` as legacy/static if it remains outside the deployed Worker/Pages path.
5. Clean or document generated artifacts without deleting tracked files unless the user explicitly approves.

## Starting State

Latest known core-fix commit:

- `d6a61c3 Repair Worker refresh schema and dashboard compatibility`

Known completed work:

- Worker refresh includes all 16 required searches from `docs/data_sources.md`.
- Worker postprocess emits canonical top-level `scenario_probs`.
- Threshold alerts are deterministic and aligned to `docs/framework.md`.
- Frontend reads canonical `scenario_probs` and falls back to old `scenarios.sN.prob`.
- Frontend has S1/S2/S3 history charts.
- README explains local JSON and Worker KV are separate.

Known remaining state:

- `AGENTS.md` and `CLAUDE.md` still describe local commands without clearly warning that they do not read Worker KV.
- `cloudflare/src/worker.js` still uses a generic `ELABORATE_SYSTEM_PROMPT` and short hard-coded `SCENARIO_QUERIES` rather than the full scenario doc searches/templates.
- There is no KV-to-local sync/export command.
- `templates/dashboard_template.html` is not clearly marked legacy/static.
- Worktree may contain generated artifacts such as `output/report.pdf`, `output/*.png`, or `yield-integration-docs.zip`.

## Non-Goals

- Do not change framework thresholds unless the user explicitly asks.
- Do not redesign the dashboard.
- Do not delete tracked output screenshots or PDFs without explicit approval.
- Do not require network access for local tests unless a sync/deploy command genuinely needs it and approval is granted.

## Workstream 1: Documentation and Command Semantics

### Files

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `templates/dashboard_template.html`

### Tasks

1. Add a concise "Data source split" note to `AGENTS.md` and `CLAUDE.md`:
   - local commands operate on `data/weekly_log.json`,
   - deployed dashboard history lives in Worker KV,
   - there is no automatic sync unless Phase 2B implements it,
   - if KV sync is implemented, name the command/script.
2. Ensure README remains consistent with the chosen sync/legacy approach.
3. Add an HTML comment and/or visible maintainer note at the top of `templates/dashboard_template.html` if it is legacy/static.

### Acceptance

- A future agent reading only `AGENTS.md` cannot confuse local JSON with Worker KV.
- README, AGENTS, and CLAUDE use the same terminology for Path A local and Path B deployed.
- `templates/dashboard_template.html` status is clear.

## Workstream 2: Worker KV to Local Sync Decision

### Preferred Option A: Implement KV Export Script

Add a script that can export Worker KV history into canonical local JSON.

Potential files:

- `scripts/sync_worker_kv.py` or `scripts/sync_worker_kv.js`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`

Recommended behavior:

1. Fetch deployed Worker history through the public `/api/history` endpoint if available.
2. For each date, fetch `/api/history?date=YYYY-MM-DD` if full entries are needed.
3. Normalize entries into canonical `docs/output_schemas.md` shape.
4. Merge with `data/weekly_log.json` by date.
5. Write to `data/weekly_log.json` only when explicitly invoked.
6. Provide a dry-run mode if reasonably easy.

Why endpoint-first:

- It avoids requiring direct Cloudflare KV credentials locally.
- It uses the already deployed API contract.
- It is easier to run from Windows/PowerShell than raw `wrangler kv` commands.

Constraints:

- Network access is restricted in this environment. If testing the endpoint requires network and fails, document the command and test locally with a fixture.
- Do not embed secrets.

### Option B: Explicitly Mark Local JSON as Legacy/Manual

If sync is too broad for this pass:

1. Update docs to say local report/log/obsidian commands are manual/offline tools.
2. Add a TODO section naming the future sync command.
3. Do not pretend local JSON is current.

### Acceptance

- Either a sync/export path exists and is documented, or local JSON is clearly marked manual/offline.
- No user secrets are added.
- `data/weekly_log.json` is not overwritten with live data unless explicitly intended.

## Workstream 3: Elaboration Template Integration

### Files

- `cloudflare/src/worker.js`
- `docs/scenarios/s1_no_pivot.md`
- `docs/scenarios/s2_tariff_rollback.md`
- `docs/scenarios/s3_oil_trap.md`
- `docs/output_schemas.md`

### Tasks

1. Replace the generic elaboration system with scenario-specific structure.
2. Update `SCENARIO_QUERIES` to include the full "Elaboration searches" from each scenario file.
3. Update scenario prompts so each scenario follows its documented "Elaboration template":
   - S1: 7 sections.
   - S2: 6 sections.
   - S3: 6 sections.
4. Decide output format:
   - Preferred for Worker cached elaborations: HTML paragraphs using `<p>` and `<b>` where feasible.
   - If the frontend renderer still supports markdown, keep markdown compatibility but instruct the model to use stable section labels.
5. Preserve existing Chinese translation and `/api/elaboration/:n` caching behavior.
6. Keep outputs concise enough for provider token limits, but do not collapse away required sections.

### Acceptance

- S1/S2/S3 elaboration prompts visibly include the section names from their scenario docs.
- S1/S2/S3 Tavily query lists match the scenario docs' elaboration searches.
- `/api/elaboration/:n` behavior remains compatible with the frontend.
- Chinese translation/caching still works.
- `node --check cloudflare/src/worker.js` passes.

## Workstream 4: Artifact and Git Hygiene

### Files/paths

- `output/report.pdf`
- `output/*.png`
- `yield-integration-docs.zip`
- `.gitignore`

### Tasks

1. Report current generated artifacts to the user or in final notes.
2. Do not delete or untrack anything without explicit user approval.
3. If appropriate, add ignore rules for future generated screenshots, but note that already tracked files remain tracked.
4. Avoid committing regenerated binary outputs unless the user wants them.

### Acceptance

- Final status clearly states what generated artifacts remain.
- No accidental deletion of tracked outputs.

## Suggested Execution Order

1. Read current status files and latest git status.
2. Complete Workstream 1 docs first.
3. Decide Workstream 2:
   - If implementing sync, write the script with fixture-friendly tests.
   - If not implementing sync, document the manual/offline status cleanly.
4. Complete Workstream 3 elaboration templates.
5. Run verification:
   - `node --check cloudflare/src/worker.js`
   - local script syntax check if a sync script is added
   - `rg` checks that scenario elaboration queries/sections are present
6. Update `yield-update/status/phase_2b_status.md`.
7. Final answer should separate completed items from deferred items.

## Verification Checklist

- `AGENTS.md` mentions local JSON and Worker KV split.
- `CLAUDE.md` mentions local JSON and Worker KV split.
- README is consistent with AGENTS/CLAUDE.
- `templates/dashboard_template.html` is marked legacy/static if not used by deployed Pages.
- KV/local sync decision is documented and, if implemented, has a clear command.
- Worker scenario elaboration query lists reflect all scenario docs.
- Worker scenario prompts reflect all scenario templates.
- Chinese translation and elaboration caching are preserved.
- `node --check cloudflare/src/worker.js` passes.
- Worktree generated artifacts are reported.

## Final Deliverable

At the end of Phase 2B, provide:

1. Files changed.
2. Whether KV sync was implemented or explicitly deferred.
3. Elaboration template integration summary.
4. Verification commands and results.
5. Remaining generated artifacts or cleanup recommendations.

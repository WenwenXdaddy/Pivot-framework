# Phase 2B Start Prompt

Use this prompt after clearing context.

```text
You are continuing work in E:\macro-regime\pivot-framework.

Read these first:
1. AGENTS.md
2. yield-update/PHASE_2B_PLAN.md
3. yield-update/status/phase_2b_status.md if it exists
4. yield-update/THREE_AGENT_FIX_PLAN.md for background only

Context:
- The previous core repair is complete in commit d6a61c3: Worker refresh schema, 16 searches, deterministic thresholds, frontend S3 chart, provider info, and report compatibility were fixed.
- Phase 2B remains: docs/data-source semantics, Worker KV/local weekly_log decision, scenario-specific elaboration templates, legacy template labeling, and generated artifact hygiene.
- Do not assume local data/weekly_log.json is synced with deployed Worker KV.
- Do not delete tracked output files or generated screenshots without explicit approval.

Your tasks:
1. Inspect git status and existing Phase 2B status.
2. Update AGENTS.md and CLAUDE.md so future agents understand:
   - local commands operate on data/weekly_log.json,
   - deployed dashboard history lives in Worker KV,
   - sync is absent unless you implement it in this phase.
3. Mark templates/dashboard_template.html as legacy/static if it is not part of the deployed Worker/Pages path.
4. Decide whether to implement KV-to-local sync now:
   - Preferred: add a safe endpoint-based script that reads /api/history and merges canonical entries into data/weekly_log.json, with dry-run if practical.
   - If not implementing, document the local path as manual/offline and state the future sync command idea.
5. Integrate scenario-specific elaboration templates in cloudflare/src/worker.js:
   - update SCENARIO_QUERIES to match each docs/scenarios/* "Elaboration searches" list,
   - update elaboration prompts/system prompt so S1 has 7 documented sections, S2 has 6, S3 has 6,
   - preserve Chinese translation and /api/elaboration/:n caching behavior.
6. Run verification:
   - node --check cloudflare/src/worker.js
   - syntax check for any new sync script if possible
   - rg checks for key section titles/search terms
7. Update yield-update/status/phase_2b_status.md with concise checkpoints.
8. Final response should clearly say:
   - what was completed,
   - what was deferred,
   - commands run,
   - generated artifacts still present.

Follow existing repo style. Use apply_patch for manual edits. Do not revert user changes. Keep edits scoped.
```

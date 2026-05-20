# Start After Context Reset

The pre-flight preparation has already been completed.

Completed commits:

- `2e01560` - `Add Chinese localization, elaboration caching, and language toggle to Cloudflare dashboard`
- `9ecde58` - `Add yield channel integration plan and agent prompts`

The only expected untracked files after these commits are generated/reference artifacts outside the integration plan, such as:

- `output/dashboard-en.png`
- `output/elab-cn-current.png`
- `output/elab-cn-fixed.png`
- `yield-integration-docs.zip`

Do not include those in the yield integration unless explicitly requested.

## Next Instruction To Give Codex

Use this prompt after resetting context:

```text
Continue the Yield Channel integration from the prepared handoff. Read:

1. yield-update/START_AFTER_CONTEXT_RESET.md
2. yield-update/INTEGRATION_PLAN_V2_FINAL.md
3. yield-update/COORDINATION.md
4. yield-update/AGENT_A_START_PROMPT.md
5. yield-update/AGENT_B_START_PROMPT.md

Then start the implementation. Agent A is the main agent and owns docs/data/project descriptions. Agent B owns code/frontend/template. Preserve the file ownership boundaries and merge Agent A first, then Agent B.
```

## Implementation Order

1. Start Agent A with `yield-update/AGENT_A_START_PROMPT.md`.
2. Start Agent B with `yield-update/AGENT_B_START_PROMPT.md`.
3. Agent A completes docs/data/project description work.
4. Agent B completes report/Worker/frontend/template work.
5. Merge or integrate Agent A first.
6. Merge or integrate Agent B second.
7. Run final verification from `yield-update/INTEGRATION_PLAN_V2_FINAL.md`.

## Critical Reminders

- Keep local and Worker schemas dual-track.
- Compute ERP deterministically from `sp500_forward_pe` and `yield_10y`.
- `2026-03-28` ERP backfill is `0.33`, not negative.
- Do not describe 4.75% as fixed ERP-zero. It is a warning zone.
- Preserve Chinese localization and elaboration caching in Cloudflare files.

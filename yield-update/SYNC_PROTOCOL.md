# Agent Sync Protocol

This file defines how Agent A and Agent B stay aligned without requiring the user to relay messages manually.

## Principle

Agent A is the main agent and integration owner. Agent B is an implementation worker for code/frontend/template work. Agent B should not wait on Agent A for every small edit, but both agents must publish short status checkpoints at natural boundaries.

## Status Files

Each agent writes only its own status file:

- Agent A writes `yield-update/status/agent_a_status.md`
- Agent B writes `yield-update/status/agent_b_status.md`

The files are intentionally separate to preserve low-conflict parallel work.

## Checkpoint Format

At the end of each task group, append one short checkpoint:

```markdown
## YYYY-MM-DD HH:MM - <agent>

Status: in_progress | blocked | complete
Task group: <short name>
Files touched:
- <path>

Done:
- <one-line result>

Next:
- <one-line next step>

Needs from other agent:
- none
```

Keep each checkpoint short. The status file is for coordination, not a diary.

## Required Checkpoints

Agent A must checkpoint after:

1. Copying docs into `docs/`.
2. Backfilling `data/weekly_log.json`.
3. Updating `CLAUDE.md`, `AGENTS.md`, and `README.md`.
4. Final validation of its owned files.

Agent B must checkpoint after:

1. Updating `scripts/generate_reports.py`.
2. Updating `cloudflare/src/worker.js`.
3. Updating `cloudflare/public/index.html`.
4. Updating `templates/dashboard_template.html`.
5. Final local verification.

## Cross-Agent Reads

Agent A must read `yield-update/status/agent_b_status.md` before final integration review.

Agent B must read `yield-update/status/agent_a_status.md` before final verification if the file exists. If Agent A is not done yet, Agent B should still finish its owned work and note any assumptions in its own status file.

## Blocking Rules

If an agent is blocked by the other agent:

1. Write `Status: blocked` in its own status file.
2. Put the exact question under `Needs from other agent`.
3. Stop only the blocked task group; continue other non-overlapping work if possible.

The orchestrating Codex instance is responsible for reading both status files and passing the relevant request to the other agent. The user should not need to relay routine status.

## Final Integration

Before merging Agent B after Agent A:

1. Read both status files.
2. Confirm neither file has unresolved `Status: blocked`.
3. Confirm file ownership boundaries were respected.
4. Run the verification checklist in `yield-update/INTEGRATION_PLAN_V2_FINAL.md`.

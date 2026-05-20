# Yield Integration Coordination Notes

## Roles

Agent A is the main agent. It owns the data contract, docs, historical data, and project documentation. Agent A should be merged first.

Agent B owns code and UI implementation. Agent B should work from the post-preflight commit and must preserve the existing Cloudflare localization/caching changes.

Routine status should be coordinated through `yield-update/SYNC_PROTOCOL.md`, not by asking the user to relay messages. Each agent writes only its own status file under `yield-update/status/`.

## Branch and Merge Order

1. Commit current Cloudflare work on `main`.
2. Create Agent A worktree/branch.
3. Create Agent B worktree/branch from the same post-preflight commit.
4. Merge Agent A first.
5. Merge Agent B second.
6. Run final verification from the merged branch.

## File Ownership

Agent A:

- `docs/**`
- `data/weekly_log.json`
- `CLAUDE.md`
- `AGENTS.md`
- `README.md`

Agent B:

- `scripts/generate_reports.py`
- `cloudflare/src/worker.js`
- `cloudflare/public/index.html`
- `templates/dashboard_template.html`

## Shared Contract

Both agents must use the same `readings` field names:

- `yield_10y`
- `yield_2y`
- `yield_30y`
- `spread_2s10s`
- `fed_hike_prob`
- `fed_cut_prob`
- `sp500_forward_pe`
- `erp`

Keep schema shapes separate:

- Local: `scenario_probs` plus `scenarios.sN.direction/key_signal`.
- Worker API: `scenarios.sN.prob/direction/key_signal`.

## Final Verification Commands

```powershell
python scripts/generate_reports.py
```

Recommended manual checks:

- Open `output/latest.html` and confirm yield/rates cards and charts appear.
- Open `output/report.pdf` and confirm yield/rates context appears.
- Review `cloudflare/src/worker.js` for deterministic ERP and spread calculations.
- Review `cloudflare/public/index.html` for English/Chinese yield labels.

## Status Sync

Read `yield-update/SYNC_PROTOCOL.md` before starting agent work.

Agent A status file:

- `yield-update/status/agent_a_status.md`

Agent B status file:

- `yield-update/status/agent_b_status.md`

The orchestrating Codex instance reads both files at checkpoints and routes blockers between agents. The user should not need to manually carry routine status between agents.

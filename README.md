# Trump Economic Approval → Dual-Channel Gas + Yield Policy Pivot Framework

A reusable analytical framework that tracks economic approval ratings, gas prices, and Treasury yields as leading indicators for policy pivots, with scenario analysis mapping political dynamics to market positioning.

## Project Structure

```
pivot-framework/
├── CLAUDE.md                          # Framework definition (Path A brain)
├── README.md                          # This file
├── docs/
│   ├── framework.md                   # Thresholds, transmission mechanism, probability rubric
│   ├── data_sources.md                # Required searches and source ranking
│   ├── output_schemas.md              # JSON, HTML, PDF, and Obsidian output contracts
│   └── scenarios/                     # Scenario conditions and elaboration templates
├── templates/
│   └── dashboard_template.html        # Legacy/static local HTML template
├── output/
│   └── latest.html                    # Most recent generated dashboard
├── data/
│   └── weekly_log.json                # Historical readings
└── cloudflare/                        # Path B: Deployed dashboard
    ├── wrangler.toml                  # Worker config
    ├── src/
    │   └── worker.js                  # API proxy (Anthropic + web search)
    └── public/
        └── index.html                 # Live dashboard frontend
```

---

## Path A: Claude Code (Local)

### Setup (30 minutes)

1. **Clone/copy this directory** to your working environment

2. **Open Claude Code** in the project root:
   ```bash
   cd pivot-framework
   claude
   ```

3. **Run your first update:**
   ```
   update the framework
   ```
   Claude Code reads CLAUDE.md, searches the web for latest data, re-evaluates
   all three scenarios, updates the weekly log, and regenerates the dashboard.

### Usage

| Command | What it does |
|---------|-------------|
| `update` | Full refresh — collect data, re-evaluate, generate dashboard |
| `elaborate on scenario 1` | Deep dive on the no-pivot stagflation positioning |
| `elaborate on scenario 2` | Deep dive on tariff rollback rally mechanics |
| `elaborate on scenario 3` | Deep dive on the oil trap underpricing |
| `log` | Show historical readings and trend |
| `obsidian` | Generate a vault-ready markdown note |

### Local Data and Reports

Path A stores its history in `data/weekly_log.json`. The local report generator
reads that file and writes `output/latest.html` and `output/report.pdf`; it does
not read from the deployed Worker KV store.

`output/latest.html` and `output/report.pdf` are committed as the local report
artifacts. Temporary dashboard/elaboration screenshots and ad-hoc integration
zip files are ignored and should not be committed.

To merge deployed Worker KV history into the local log, run a dry run first:

```bash
python scripts/sync_worker_history.py
```

Then write the merged history if the preview looks right:

```bash
python scripts/sync_worker_history.py --write
```

Run the local regression checks before committing changes:

```bash
python scripts/run_checks.py
```

### Yield Channel

The framework now tracks two parallel pressure channels:

- **Gas channel:** oil shock → gas prices rise → economic approval falls → GOP defections → policy pivot
- **Yield channel:** inflation and fiscal stress → 10Y/30Y yields rise → mortgage and borrowing costs tighten → affordability pain broadens → GOP defections → policy pivot

Yield readings live in `readings` alongside the existing political and commodity fields: `yield_10y`, `yield_2y`, `yield_30y`, `spread_2s10s`, `fed_hike_prob`, `fed_cut_prob`, `sp500_forward_pe`, and `erp`. ERP is computed deterministically as `(1 / sp500_forward_pe) * 100 - yield_10y`; the 4.60% 10Y level is a warning zone, not a fixed ERP-zero threshold.

### Weekly Ritual

Every weekend (or whenever you want a refresh):
1. `cd pivot-framework && claude`
2. Say: "update"
3. Review the scenario probability shifts
4. Say: "elaborate on scenario X" for whichever shifted most
5. Say: "obsidian" to generate a vault note
6. Copy `output/latest.html` to share (e.g., WhatsApp)

### Connecting to Obsidian

The `obsidian` command generates a note at `output/weekly_note.md` with YAML
frontmatter matching your vault's property schema. Copy it to your vault:

```bash
cp output/weekly_note.md /path/to/your/vault/Research/Macro/
```

Or add this to CLAUDE.md to automate it:
```
When generating the Obsidian note, copy it directly to:
/path/to/your/vault/Research/Macro/pivot-tracker-{{date}}.md
```

---

## Path B: Cloudflare (Deployed)

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Anthropic API key
- Cloudflare account

### Setup (2-3 hours)

#### 1. Deploy the Worker

```bash
cd cloudflare

# Login to Cloudflare
wrangler login

# Set your Anthropic API key as a secret
wrangler secret put ANTHROPIC_API_KEY
# Paste your key when prompted

# Deploy the worker
wrangler deploy
```

Note the deployed URL (e.g., `https://pivot-framework-api.your-subdomain.workers.dev`).

#### 2. Update the frontend

Open `public/index.html` and replace the Worker URL:

```javascript
const WORKER_URL = 'https://pivot-framework-api.your-subdomain.workers.dev';
```

#### 3. Deploy the frontend to Cloudflare Pages

Option A — via Wrangler:
```bash
# From the static frontend directory
cd cloudflare/public
wrangler pages deploy . --project-name=pivot-dashboard --branch main
```

Option B — via Git (recommended for auto-deploy):
1. Push the `cloudflare/public/` directory to a GitHub repo
2. In the Cloudflare dashboard: Pages → Create project → Connect repo
3. Set root directory to `cloudflare/public`, build command blank, and build output directory to `/` (no build step needed)
4. Every git push auto-deploys

Keep Worker and Pages configuration separate: `cloudflare/wrangler.toml` is the Worker API config for `pivot-framework-api`, while Pages serves the static frontend from `cloudflare/public/`.

#### 4. Custom domain (optional)

In Cloudflare Pages dashboard → Custom domains → Add your domain.

### Usage

1. Visit your Pages URL
2. Click "Refresh analysis"
3. The Worker calls Claude Sonnet with web search, collects live data, re-evaluates scenarios
4. Click any scenario card for a deep-dive elaboration

### Deployed History

Path B stores deployed dashboard history in Cloudflare Worker KV. That KV
history is separate from local `data/weekly_log.json`; normal Path A updates do
not sync with KV. Use `python scripts/sync_worker_history.py --write` when you
explicitly want to merge deployed `/api/history` entries into the local log.

### Cost

- Worker: Free tier covers 100K requests/day
- Anthropic API: ~$0.05 per refresh (Sonnet + web search), ~$0.10 per elaborate
- At weekly usage: < $1/month

---

## Architecture Notes

### Why two paths?

**Path A** gives you Opus-quality analysis depth and integrates with your
existing Claude Code workflow. It's the research tool, using `docs/` as the
source of truth for searches, thresholds, scenarios, and output schemas.

**Path B** gives you a live URL you can check from your phone, share with
colleagues, and set up on a schedule. It's the monitoring tool.

They complement each other: use Path A for deep weekly analysis, Path B for
quick daily checks. Both paths should converge on the canonical data contract:
top-level `scenario_probs` plus `scenarios.sN.direction/key_signal`. Frontends
and reports may still read old `scenarios.sN.prob` history entries as a
compatibility fallback, but that old shape is not the target contract.

### Extending the framework

**Add a new scenario:** Edit the "Three Scenarios" section in CLAUDE.md. Add
strengthen/weaken conditions and positioning. Claude Code will automatically
include it in re-evaluations.

**Add a new data source:** Add it to `docs/data_sources.md` with the search
query. Claude Code will search for it on each update.

**Add charts:** The deployed dashboard lives in `cloudflare/public/index.html`.
The older `templates/dashboard_template.html` file is a legacy/static local
template and is not part of the current Worker/Pages deployment path.

**Add cron scheduling (Path B):** Add a cron trigger to the Worker:
```toml
# In wrangler.toml
[triggers]
crons = ["0 14 * * 1"]  # Every Monday at 2pm UTC
```
Then add a `scheduled` handler in worker.js that calls handleRefresh and stores
the result in KV.

### Security

- Path A: No API keys exposed — Claude Code handles auth.
- Path B: API key stored as a Cloudflare Worker secret (encrypted, never in
  code). The Worker acts as a proxy so the key never reaches the browser.

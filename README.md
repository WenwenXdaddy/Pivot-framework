# Trump Economic Approval → Policy Pivot Framework

A reusable analytical framework that tracks economic approval ratings as leading indicators for policy pivots, with scenario analysis mapping political dynamics to market positioning.

## Project Structure

```
pivot-framework/
├── CLAUDE.md                          # Framework definition (Path A brain)
├── README.md                          # This file
├── templates/
│   └── dashboard_template.html        # HTML dashboard template
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
# From the cloudflare/ directory
wrangler pages deploy public --project-name=pivot-dashboard
```

Option B — via Git (recommended for auto-deploy):
1. Push the `cloudflare/public/` directory to a GitHub repo
2. In the Cloudflare dashboard: Pages → Create project → Connect repo
3. Set build output directory to `/` (no build step needed)
4. Every git push auto-deploys

#### 4. Custom domain (optional)

In Cloudflare Pages dashboard → Custom domains → Add your domain.

### Usage

1. Visit your Pages URL
2. Click "Refresh analysis"
3. The Worker calls Claude Sonnet with web search, collects live data, re-evaluates scenarios
4. Click any scenario card for a deep-dive elaboration

### Cost

- Worker: Free tier covers 100K requests/day
- Anthropic API: ~$0.05 per refresh (Sonnet + web search), ~$0.10 per elaborate
- At weekly usage: < $1/month

---

## Architecture Notes

### Why two paths?

**Path A** gives you Opus-quality analysis depth and integrates with your
existing Claude Code workflow. It's the research tool.

**Path B** gives you a live URL you can check from your phone, share with
colleagues, and set up on a schedule. It's the monitoring tool.

They complement each other: use Path A for deep weekly analysis, Path B for
quick daily checks.

### Extending the framework

**Add a new scenario:** Edit the "Three Scenarios" section in CLAUDE.md. Add
strengthen/weaken conditions and positioning. Claude Code will automatically
include it in re-evaluations.

**Add a new data source:** Add it to the "Commands > update" section in
CLAUDE.md with the search query. Claude Code will search for it on each update.

**Add charts:** The dashboard template uses vanilla Chart.js. Add a `<canvas>`
element and a Chart.js initialization in the template to visualize historical
data from weekly_log.json.

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

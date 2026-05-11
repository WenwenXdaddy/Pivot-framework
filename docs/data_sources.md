# Data Sources

## Required searches (run ALL on every update)

| # | Metric | Search query | What to extract |
|---|--------|-------------|-----------------|
| 1 | Econ approval | `Reuters Ipsos Trump economic approval` | % approve of economic handling |
| 2 | Overall approval | `Trump approval rating latest poll` | Overall approve % |
| 3 | GOP approval | `Trump Republican approval rating` | Approve % among Republicans specifically |
| 4 | Generic ballot | `generic ballot 2026 midterms poll` | D+X or R+X spread |
| 5 | Silver Bulletin | `Nate Silver Trump approval rating` | Net approval number (e.g., -21.3) |
| 6 | VIX | `VIX index today` | Current VIX level |
| 7 | Gold | `gold price today` | Spot price USD/oz |
| 8 | Oil | `oil price WTI Brent today` | WTI and Brent per barrel |
| 9 | Gas | `average gas price US today` | National average per gallon |
| 10 | Iran | `Iran war ceasefire negotiations latest` | Current status of conflict and diplomacy |
| 11 | Tariffs | `Congress tariff vote Republican 2026` | Any new defections or legislative activity |

## Source ranking by signal frequency

### High frequency (weekly)
- **Reuters/Ipsos Core Political** — 4-day rolling online surveys. Fastest-updating benchmark. Produced the 29% econ approval reading (March 2026 baseline).
- **Morning Consult Pro** — Weekly tracker across 12 issue areas. Economy at 51% disapproval in baseline.
- **Silver Bulletin (Nate Silver)** — Daily aggregate of multiple polls. Net econ approval -21.3 at baseline. Cleanest single number.

### Medium frequency (monthly)
- **Pew Research ATP** — 8,500+ sample panels. Best demographic and intra-party breakdowns. Showed GOP policy support dropping from 67% to 56%.
- **Fox News Poll** — Important as a base sentiment bellwether since audience skews Republican.

### Aggregators
- **RealClearPolling** — Economy-specific approval aggregate (realclearpolling.com/polls/approval/donald-trump/issues/economy)
- **Civiqs** — State-level cumulative tracking. Useful for swing-state approval.

## Baseline readings (March 28, 2026)
For comparison on each update:
- Econ approval: 29% (Reuters/Ipsos)
- GOP approval: 82% (Reuters/Ipsos)
- Generic ballot: D+9
- Silver Bulletin net: -21.3
- Overall approval: 36%
- VIX: 31
- Gold: $4,493
- WTI: $94 / Brent: $104
- Gas: $4.00+

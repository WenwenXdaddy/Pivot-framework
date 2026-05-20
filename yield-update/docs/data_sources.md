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
| 12 | 10Y yield | `10 year Treasury yield today` | Current 10Y yield % |
| 13 | 2Y yield | `2 year Treasury yield today` | Current 2Y yield % (for spread calc) |
| 14 | 30Y yield | `30 year Treasury yield today` | Current 30Y yield % (mortgage proxy) |
| 15 | Fed pricing | `CME FedWatch rate hike cut probability 2026` | Implied prob of next hike/cut, # of cuts/hikes priced for 2026 |
| 16 | S&P 500 forward P/E | `S&P 500 12 month forward P/E FactSet latest` | Current forward P/E for deterministic ERP calculation |

## Source ranking by signal frequency

### High frequency (weekly)
- **Reuters/Ipsos Core Political** — 4-day rolling online surveys. Fastest-updating benchmark.
- **Morning Consult Pro** — Weekly tracker across 12 issue areas.
- **Silver Bulletin (Nate Silver)** — Daily aggregate of multiple polls. Net econ approval -21.3 at baseline.
- **FRED / Treasury.gov** — Daily yield data. 10Y (DGS10), 2Y (DGS2), 30Y (DGS30). The authoritative source.
- **CME FedWatch** — Real-time implied rate path from futures. Updated continuously.

- **FactSet / Yardeni / LSEG forward P/E** - Use current S&P 500 12-month forward P/E to compute ERP deterministically.

### Medium frequency (monthly)
- **Pew Research ATP** — 8,500+ sample panels. Best demographic and intra-party breakdowns.
- **Fox News Poll** — Base sentiment bellwether.

### Aggregators
- **RealClearPolling** — Economy-specific approval aggregate.
- **Civiqs** — State-level cumulative tracking.

## Baseline readings

### Political (March 28, 2026 baseline)
- Econ approval: 29% (Reuters/Ipsos)
- GOP approval: 82% (Reuters/Ipsos)
- Generic ballot: D+9
- Silver Bulletin net: -21.3
- Overall approval: 36%

### Market (updated May 20, 2026)
- VIX: 31
- Gold: $4,493
- WTI: $101 / Brent: $115
- Gas: $3.98
- 10Y yield: 4.67% (16-month high)
- 2Y yield: 4.09%
- 30Y yield: 5.20% (18-year high)
- 2s10s spread: +58bp (bear steepening)
- Fed hike probability: 40% (CME FedWatch, 0 cuts priced for 2026)
- S&P 500 forward P/E: ~24.0 (ERP input)

# Framework

## Transmission mechanism

There are now TWO parallel transmission channels feeding into the pivot decision:

### Channel 1: Gas price channel (original)
```
Oil shock → Gas prices rise → Econ approval collapses → Intra-GOP fracture → Congressional break → Policy pivot
```

### Channel 2: Yield channel (new)
```
Oil shock → Inflation re-accelerates → 10Y reprices higher → Mortgage/borrowing costs surge → Affordability pain broadens → Intra-GOP fracture → Congressional break → Policy pivot
```

The yield channel operates on a SLOWER timeline than the gas channel (weeks vs days) but hits a BROADER voter base — gas affects drivers, but yields affect anyone with a mortgage, auto loan, or small business credit line. The yield channel also creates a feedback loop the gas channel doesn't: higher yields → tighter financial conditions → weaker economy → lower approval, regardless of what gas does.

**Key insight: S3 (oil trap) originally broke the framework by removing gas price pain. But if yields stay elevated even after a ceasefire — because the "security tax" keeps inflation above target — Channel 2 keeps the defection pressure alive. This is the major analytical upgrade from adding yields.**

The actionable signal remains the **rate of GOP-specific erosion** — but now you watch for erosion driven by EITHER channel.

## Key thresholds

### Political thresholds
| Metric | Warning | Critical | Market meaning |
|--------|---------|----------|---------------|
| Econ approval (Reuters/Ipsos) | < 30% | < 25% | Below Biden floor = political cover for defections |
| GOP approval | < 80% | < 75% | Defection math reaches critical mass |
| Generic ballot | D+7 or wider | D+12 or wider | Midterm panic = must-pass legislation becomes vehicle |
| GOP policy support (Pew) | < 55% | < 50% | Base permission structure breaking |

### Market thresholds
| Metric | Warning | Critical | Market meaning |
|--------|---------|----------|---------------|
| VIX | > 30 | > 40 | Elevated floor vs crisis regime |
| WTI crude | > $100 | > $120 | Hormuz supply shock escalation |
| Gas price avg | > $4.00 | > $5.00 | Voter pain threshold — primary approval driver (Channel 1) |
| **10Y yield** | **> 4.60%** | **> 5.00%** | **4.60% = warning zone where ERP is likely compressed or inverted depending on S&P 500 forward P/E. 5.00% = financial conditions tightening independently of Fed. Triggers Channel 2 voter pain via mortgage/borrowing costs.** |
| **2s10s spread** | **> +75bp** | **> +100bp** | **Bear steepener = term premium driven (fiscal/inflation), not growth. Worst regime for risk assets. Signals fiscal stress from tariff revenue shortfall.** |
| **30Y yield** | **> 5.25%** | **> 5.50%** | **Mortgage rate proxy. Above 5.5% = housing market freeze, direct voter pain independent of gas prices.** |
| **Fed hike probability** | **> 30%** | **> 50%** | **Above 50% = market pricing a hike as base case. Bearish for all duration-sensitive assets. Transforms the macro regime from "higher for longer" to "higher still."** |

When a threshold is crossed, include it in `threshold_alerts` array. Format: `"WARNING: Metric (value) crossed warning threshold"` or `"CRITICAL: ..."`.

## Scenario probability rubric

For each scenario:
1. Count how many "strengthen" conditions (listed in that scenario's doc) are currently met
2. Count how many "weaken" conditions are currently met
3. Net score = strengthen - weaken
4. Assign direction: net > 0 = "strengthening", net < 0 = "weakening", net = 0 = "stable"
5. Convert to probability: higher net score = higher probability
6. All three probabilities MUST sum to 1.0
7. Compare to prior entry in weekly_log.json for delta

**Yield-aware weighting:** When the 10Y is above 4.60%, give extra weight (+0.05 probability) to whichever scenario the yield dynamics most support. Typically this strengthens S1 (stagflation intensifies) and S2 (affordability pressure broadens) while weakening S3 (yields don't normalize with oil).

## Cross-scenario logic

The three scenarios are **mutually exclusive outcomes of the same transmission mechanism**:
- S1 (no pivot): the transmission mechanism stalls at "Intra-GOP fracture" — not enough defections
- S2 (rollback): the transmission mechanism completes — defections force a pivot
- S3 (oil trap): the transmission mechanism is **short-circuited** — gas relief removes the affordability shock input, so the whole chain never activates even though tariffs persist

Key dependency: **S3 breaks S2's catalyst.** If gas prices fall from a ceasefire, the political urgency that drives Republican defections evaporates.

**NEW: Yield complication for S3.** The yield channel partially compensates for the loss of gas price pressure. If 10Y stays above 4.60% even after a ceasefire — because tariff inflation and fiscal deficits persist — Channel 2 keeps the affordability pain alive. This makes S3 less stable than originally modeled: the "trap" may spring open if yields stay elevated long enough to sustain defection pressure through a different affordability channel.

## The 10Y as equity valuation governor

The 10Y yield functions as the discount rate for all future equity earnings. Track the equity risk premium (ERP):

```
ERP = S&P 500 earnings yield - 10Y yield
    = (1 / forward P/E) - 10Y
```

| ERP level | Market regime | Implication |
|-----------|--------------|-------------|
| > 200bp | Normal | Equities offer meaningful premium over bonds |
| 100-200bp | Compressed | Rotation from growth to value accelerates |
| 0-100bp | Critical | Capital rotates mechanically into bonds. Duration-sensitive equities (tech, REITs) under structural pressure |
| < 0bp | Inverted | Equities are "expensive" relative to risk-free. Only earnings growth can justify holding. Bear market risk elevated |

The zero-ERP 10Y level is dynamic: `erp_zero_yield = (1 / sp500_forward_pe) * 100`. If forward P/E is 24, zero ERP is approximately 4.17%; if forward P/E is 21, zero ERP is approximately 4.76%. Track `sp500_forward_pe`, `yield_10y`, and computed `erp` together rather than treating 4.60% as a fixed zero-ERP boundary.

At current levels (S&P earnings yield ~4.2%, 10Y at 4.67%), the ERP is approximately -47bp — already inverted. This is the quantitative backbone of the S1 "slow grind" thesis.

# Framework

## Transmission mechanism
```
Affordability shock → Econ approval collapses → Intra-GOP fracture → Congressional break → Policy pivot
(gas + tariffs)        (below Biden floor)       (GOP < 80%)           (Rs demand relief)   (tariff rollback)
```

The actionable signal is NOT the headline approval number (already at historic lows). It is the **rate of GOP-specific erosion** — the 82% → 75% gap is where Congressional Republicans start calculating that loyalty costs them their seat.

## Key thresholds
| Metric | Warning | Critical | Market meaning |
|--------|---------|----------|---------------|
| Econ approval (Reuters/Ipsos) | < 30% | < 25% | Below Biden floor = political cover for defections |
| GOP approval | < 80% | < 75% | Defection math reaches critical mass |
| Generic ballot | D+7 or wider | D+12 or wider | Midterm panic = must-pass legislation becomes vehicle |
| GOP policy support (Pew) | < 55% | < 50% | Base permission structure breaking |
| VIX | > 30 | > 40 | Elevated floor vs crisis regime |
| WTI crude | > $100 | > $120 | Hormuz supply shock escalation |
| Gas price avg | > $4.00 | > $5.00 | Voter pain threshold — primary approval driver |

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

## Cross-scenario logic

The three scenarios are **mutually exclusive outcomes of the same transmission mechanism**:
- S1 (no pivot): the transmission mechanism stalls at "Intra-GOP fracture" — not enough defections
- S2 (rollback): the transmission mechanism completes — defections force a pivot
- S3 (oil trap): the transmission mechanism is **short-circuited** — gas relief removes the affordability shock input, so the whole chain never activates even though tariffs persist

Key dependency: **S3 breaks S2's catalyst.** If gas prices fall from a ceasefire, the political urgency that drives Republican defections evaporates. This is why S3 is the "trap" — it looks like relief but actually locks in tariff status quo.

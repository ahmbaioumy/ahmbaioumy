# Validation Framework

## Tier 1 — Exact-Value Regression (every commit)

- Erlang B/C/A at multiple load levels
- Erlang C abandonment always 0%
- Date parsing consistency (DMY/MDY/YMD from unambiguous rows)
- Imputation method distinctness (median ≠ linear ≠ rolling)
- Display KPIs match decision KPIs from same model

## Tier 2 — Cross-Validation (every PR)

- Analytic sizing vs discrete-event simulation tolerance check
- Pipeline data conservation (upload → forecast → sizing)
- Boundary cases: zero volume, insufficient history, coverage gaps
- CSV upload with ambiguous date formats

## Tier 3 — Parallel-Run (pre-production)

Before trusting live staffing decisions, run alongside incumbent process for 2–4 weeks. Compare predicted vs actual SLA/ASA/Abandonment. Target: ±5 percentage points SLA over 4 weeks.

Not automated — requires signed-off operational validation.

# User Guide

## Getting Started

1. Launch the application: `python src/main.py`
2. Follow the left-side step navigator through each pipeline stage
3. Click **Next** on each screen to advance

## Stage Guide

### Upload
Load a CSV or Excel file with at minimum `timestamp` and `volume` columns. Review the data quality summary before continuing.

### Profile
Set SLA target (default 80/20), AHT, shrinkage (default 30%), and occupancy. Toggle **Advanced** to select Erlang A/B/C model.

### Cleanse
Choose an imputation method for detected anomalies. The comparison table shows exactly which rows changed.

### Forecast
The system auto-selects the best forecast model by holdout WMAPE. If history is insufficient, a visible badge explains the fallback.

### Size
Erlang sizing converts forecast demand to required agents per interval. KPIs (SLA, ASA, abandonment) come from the same model selected in Profile.

### Schedule
Enter available headcount. Coverage gaps are flagged with specific dates and intervals.

### Simulate
Discrete-event simulation cross-checks analytic Erlang results. Warm-up intervals are excluded from statistics.

### Report
One-click Excel export with traceable headline numbers.

## Units

All numeric fields show units inline: seconds, %, FTE. Hover dotted labels for plain-language explanations.

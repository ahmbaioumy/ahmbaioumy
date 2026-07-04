# Architecture

## Overview

WFM Planning Suite is a PySide6 desktop application with strict separation between calculation logic (`core/`) and presentation (`ui/`).

## Module Boundaries

| Layer | Responsibility | Constraints |
|-------|---------------|-------------|
| `core/` | All business logic, Erlang math, forecasting, simulation | No PySide6 imports; no network I/O |
| `ui/` | Widgets, navigation, rendering | Calls `core/` only; no duplicate formulas |
| `wfm_io/` | File read/write, profile JSON, auto-save state | Uses `core/datetime` for all date parsing |

## Data Flow

```
Profile → RawUpload → CleansedSeries → Forecast → IntervalDemand → SizingResult → Schedule → SimulationResult → Report
```

Each entity is serializable independently for auditability.

## CI Enforcement

- `scripts/check_offline.py` — scans `src/` for networking imports
- `scripts/check_core_isolation.py` — ensures `core/` has no PySide6
- Tier 1/2 pytest markers gate every PR

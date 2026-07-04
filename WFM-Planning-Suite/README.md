# WFM Planning Suite

Workforce management planning for contact centers — upload historical data, forecast demand, size staffing with Erlang, build schedules, and export reports.

**Two ways to use it:**

| Version | Best for | How to open |
|---------|----------|-------------|
| **Web app** (recommended) | Most users — no install | https://ahmbaioumy.github.io/ahmbaioumy/ |
| **Desktop app** | Offline / air-gapped environments | Python + PySide6 (see below) |

See [docs/WEB_ACCESS.md](docs/WEB_ACCESS.md) for a **simple, non-technical guide** to the web app.

See [PRD.md](PRD.md) for the full product requirements document.

## Pipeline

```
Upload → Profile → Cleanse → Forecast → Size → Schedule → Simulate → Report
```

## Web App (GitHub Pages)

```bash
cd WFM-Planning-Suite/web
npm install
npm run dev        # local preview at http://localhost:5173
npm run build      # production build
```

The site deploys automatically to GitHub Pages when changes merge to `main`.
Enable **Settings → Pages → Source: GitHub Actions** on the repo (one-time).

## Desktop App

```bash
cd WFM-Planning-Suite
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

## Running Tests

```bash
# Tier 1 — exact-value regression (every commit)
pytest tests/ -m tier1 -v

# Tier 2 — cross-validation and boundary tests
pytest tests/ -m tier2 -v

# CI checks
python scripts/check_offline.py
python scripts/check_core_isolation.py
```

## Architecture

```
src/
├── core/          # Pure calculation logic (no PySide6)
│   ├── datetime/  # Single date-parsing utility
│   ├── erlang/    # Erlang A/B/C engine
│   ├── cleansing/ # Anomaly detection + imputation
│   ├── forecasting/
│   ├── sizing/
│   ├── scheduling/
│   ├── simulation/
│   └── reporting/
├── ui/            # PySide6 widgets (thin layer)
├── wfm_io/        # File import/export, state persistence
└── main.py
```

## Key Design Principles

1. **One formula, one home** — all calculations live in `core/`
2. **No silent fallbacks** — approximations are visible in UI and exports
3. **Offline by construction** — zero network calls, enforced by CI
4. **Core logic is UI-independent** — fully unit-testable without a GUI

## Sample Data

A sample interval CSV is in `tests/fixtures/sample_interval_data.csv`.

## License

Internal use.

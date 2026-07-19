# Product Requirements Document — Contact Center Workforce Planning Studio

**Status:** Draft v2.0  
**Product name:** Workforce Studio (Planner Edition) / Contact Center Workforce Planning Studio  
**Reference prototype:** [workforce-planner.ai.studio](https://workforce-planner.ai.studio)  
**AI Studio app id:** `024f1936-c4a8-404f-8ec0-61b485605607`  
**Owner:** Ahmed Abdelfatah  
**Source note:** This PRD is reverse-engineered from the live Google AI Studio Workforce Planner app and the existing WFM Planning Suite codebase. The original Gemini chat at `ai.studio/apps/...` requires Google authentication and was not readable in this environment; the shipped app is treated as the authoritative expression of that conversation.

---

## 1. Product Vision & Problem Statement

**Vision:** A guided, end-to-end workforce planning engine where a contact-center planner configures multi-channel SLA targets, ingests (or synthesizes) queue telemetry, forecasts demand, sizes staffing with Erlang models, plans hiring capacity, builds shift rosters, simulates queue performance, and exports a defensible labor/budget plan — all in one sequential workflow.

**Tagline (from product UI):**  
> Welcome to the Workforce Planning Engine. As a planner, you can simulate and schedule shifts perfectly across multiple transaction channels. Configure targets below, load standard templates, and complete the end-to-end operational pipeline step-by-step.

**Problem:** Contact-center WFM planning is usually fragmented across spreadsheets, ad-hoc Erlang calculators, and expensive enterprise suites. Planners need a single pipeline that connects:

1. Channel SLA / labor assumptions  
2. Historical volume cleansing  
3. Demand forecasting  
4. Erlang staffing  
5. Hiring / capacity planning  
6. Shift rostering  
7. Queue simulation (SLA verification)  
8. Cost / budget export  

…with clear gates between stages so incomplete or uncertified work cannot silently corrupt downstream decisions.

**What “done” looks like:** A planner loads a preset (or configures channels), uploads/generates interval data, certifies each stage, and exports a Master Plan (Excel) plus raw CSV summaries — with every staffing and budget figure traceable to the stage and parameters that produced it.

---

## 2. Goals & Non-Goals

### Goals

- Deliver an **8-stage gated pipeline**: Profile → Ingest/Cleanse → Forecast → Erlang Size → Capacity/Hiring → Shift Schedule → Queue Simulation → Cost/Export.
- Support **multi-channel** planning (Voice, Chat, Email, Social/Messaging, Complaints, Outbound) with per-channel SLA and sizing parameters.
- Provide **planner presets** for fast starts (Voice-Heavy, Digital Concurrency, Elite SLA, Minimal Backlogs).
- Offer **synthetic sample data generation** so demos and training do not require a real ACD extract.
- Make approximations and bottlenecks **visible** (training-facility limits, under-coverage intervals, certification gates).
- Produce **stakeholder-ready exports**: Master Plan Excel, raw summary CSV, weekly roster CSV.

### Non-Goals (v1 / current prototype scope)

- No live ACD/CTI/telephony API integration — input is CSV upload or generated sample data.
- Not a multi-tenant SaaS with org isolation, SSO, or role-based admin console.
- No real-time intraday re-forecast or automated re-optimization after the plan is published.
- Not a full HRIS/payroll system — cost modeling is planning-grade, not payroll-grade.
- Desktop air-gapped packaging is a related product track (`WFM-Planning-Suite` desktop) and is out of scope for the AI Studio web prototype itself.

---

## 3. Users & Personas

| Persona | Role | Needs |
|---|---|---|
| **WFM Planner / Analyst** (primary) | Runs weekly/monthly planning cycle | Guided path from data → roster → budget; sensible defaults; certify-before-continue gates |
| **Ops / WFM Manager** (secondary) | Signs off on plans | One-page budget/SLA summary, hiring roadmap, coverage vs. requirement charts |
| **Finance partner** (tertiary) | Reviews labor budget | Exportable cost sheet: recruitment, training, base wages, OT penalty, cost/contact |
| **Trainer / demo user** | Learns the tool without real data | Generate Sample Data + presets |

---

## 4. Product Surface & Access

| Surface | URL | Notes |
|---|---|---|
| Public prototype | https://workforce-planner.ai.studio | Full interactive planner UI |
| AI Studio editor/chat | https://ai.studio/apps/024f1936-c4a8-404f-8ec0-61b485605607 | Requires Google sign-in; build/chat source for the prototype |
| Related open implementation | `WFM-Planning-Suite/` in this repo | Desktop + web port of the same planning domain |

**UX shell**

- Left sidebar: 8 sequential steps with verification / lock state.
- Top status: operational planning readiness.
- Primary CTA per stage: Continue / Run / Certify.
- Success banners when a stage is verified; warnings when certification is required before unlocking the next stage.

---

## 5. End-to-End Pipeline

```
1 Profile Setup
    → 2 Historical Ingest & Cleansing
        → 3 Forecast Generation
            → 4 Erlang Sizing
                → 5 Capacity & Hiring Plan
                    → 6 Shift Scheduling
                        → 7 Queue Simulation
                            → 8 Cost Analysis & Export
```

Each stage has:

- Configurable inputs (sidebar or forms)
- An explicit compute / generate action where needed
- Charts and/or tables for review
- A **certify / verify** gate before unlocking the next stage

---

## 6. Functional Requirements by Stage

### 6.1 Step 1 — Profile Setup (Channel Settings & Labor)

**Purpose:** Capture business window, productive-hour limits, and per-channel SLA/staffing parameters before data enters the pipeline.

**Presets (required)**

| Preset | Intent |
|---|---|
| Standard Voice-Heavy | SLA 80/20, voice baseline, moderate digital |
| Digital Concurrency | High Chat & Social, multi-session agents |
| Elite SLA Target | SLA 90/10, high-occupancy ceiling |
| Minimal Backlogs | Email-heavy workload, lower SLA thresholds |

**Business window & labor hours**

- Operational open / close times (default example: 08:00–20:00)
- Business days of week (default Mon–Fri)
- Agent productive limits:
  - Daily productive limit (default 8 hrs)
  - Weekly contract limit (default 40 hrs)
  - Monthly work limit (default 160 hrs)
- Productive hours exclude lunches / long meetings (stated in UI)

**Channels (minimum set)**

- Voice Inbound  
- Live Chat  
- Email Support  
- Social & Messaging  
- Complaints Escalation  
- Outbound Campaigns (supported in later stages)

**Per-channel parameters**

| Parameter | Meaning | Example defaults (Voice) |
|---|---|---|
| Target Service Level % | % answered within threshold | 80% |
| SLA Time Threshold | Answer-within seconds | 20s |
| ASA Target | Target average wait | 30s |
| Answer Percentage (min) | 100% − max abandon/busy | 95% |
| Max Agent Occupancy | Burnout ceiling | 85% |
| Total Channel Shrinkage | Offline / non-productive share | 30% |
| Schedule Adherence Target | % working as rostered | 90% |
| Default AHT Reference | Fallback handle time | 280s |

Channel defaults must differ by interaction type (e.g., Chat SLA time ~45s; Email SLA time ~3600s).

**Acceptance criteria**

- Loading a preset populates all channel/business fields consistently.
- User can edit any parameter before continuing.
- Step shows verified banner and unlocks Data Ingestion.

---

### 6.2 Step 2 — Historical Ingest & Cleansing

**Purpose:** Ingest interval queue telemetry and remove / repair anomalies before forecasting.

**Ingest**

- Drag-and-drop or browse CSV upload.
- Fuzzy header matching + preview column mapper (date/interval, volume, AHT, optional channel).
- Required mapped fields: date (or timestamp), volume, AHT.
- Optional: interval time, channel.
- **Generate Sample Data:** synthetic ~30-day interval series with realistic seasonality for demos.

**Cleansing algorithms**

1. Sigma cleansing  
2. Z-Score standard deviation  
3. Interquartile Range (IQR) — recommended default for moderate dispersion  
4. Rolling Median (MAD)  
5. No Cleansing (keep raw)

**Imputation methods**

1. Rolling Mean (default)  
2. Rolling Median  
3. Forward Fill  
4. Constant Zero Drop  
5. No Replacement  

**Controls**

- Anomaly sensitivity threshold (e.g., 2.5σ)
- Recommendation panel that suggests a method based on dispersion
- Preview of cleansed vs raw values

**Acceptance criteria**

- Invalid/incomplete mapping blocks proceed with a clear error.
- Recommended method can be one-click applied.
- Certification unlocks Forecasting.

---

### 6.3 Step 3 — Forecast Generation

**Purpose:** Project workload over a chosen planning horizon using selectable forecasting models.

**Planning horizons**

- 7-Day / 30-Day / 90-Day / Yearly

**Models (minimum)**

1. Simple Interval Average  
2. Day-of-Week Moving Average  
3. Linear Growth Trend Projection  
4. Double Holt-Winters Seasonal  
5. Prophet Additive Decomposition (recommended when sample ≥ ~28 days)  
6. SARIMA Autoregressive Lag  
7. Croston Intermittent Demand (sparse channels)  
8. Consensus Ensemble Blend  

**Outputs**

- Actual vs projected volume chart (hourly/daily/weekly/monthly/yearly views)
- Table: Period, Actual Volume, Projected Volume, Variance
- Channel tabs for multi-channel series

**Acceptance criteria**

- Running forecast with insufficient history shows a clear recommendation / limitation.
- User must review & certify before Sizing unlocks.
- Chosen model identity is visible in the UI.

---

### 6.4 Step 4 — Erlang Sizing

**Purpose:** Convert forecast demand into required agents per interval, applying shrinkage and adherence buffers.

**Staffing models**

1. Erlang C (Queue Delay) — default for high-volume voice  
2. Erlang A (Abandonments / patience)  
3. Erlang B (Blocking / busy)  
4. Blended Task Concurrency (multi-session chat)  
5. Workload Sizing (Backlog) — `FTE ∝ volume × AHT / available time`

**Active adjustments (per focus channel)**

- Target SLA %, SLA Time (s), Shrinkage %, Adherence %

**Outputs**

- Chart: Raw Queue Required Agents vs Shrinkage/Adherence Staff
- Interval roster table: Period, Volume, Workload Hours, Raw Erlang, Final Required Staff

**Acceptance criteria**

- Final required staff ≥ raw Erlang after shrinkage/adherence (unless explicitly overridden).
- Model recommendation is channel-aware (Erlang C for voice queue; Workload for backlog email).
- Certification unlocks Capacity Planning.

---

### 6.5 Step 5 — Capacity & Hiring Plan

**Purpose:** Translate staffing curves into a multi-month hiring roadmap with cost and training constraints.

**Inputs**

- Starting headcount (FTE)
- Lead times: Sourcing, Training, Nesting (weeks)
- Graduation throughput rate (e.g., 85%)
- Monthly attrition (e.g., 3%)
- Max class cohort size, rooms, trainers
- Loaded hourly wage, recruitment cost/hire

**Outputs**

- Hiring funnel KPIs: Total New Hires, Acquisition Cost, Training Cost, Total Plan Budget
- Month-by-month roadmap: Target Sizing, Starting FTE, Attrition, New Cohort, Ending FTE, Deficit (OT), Month Cost
- Bottleneck warnings when required hires exceed training capacity (remaining gap treated as OT)

**Acceptance criteria**

- Changing shrinkage/SLA upstream recalculates hiring needs.
- Training bottleneck is surfaced, not silently ignored.
- Certification unlocks Shift Scheduling.

---

### 6.6 Step 6 — Shift Scheduling

**Purpose:** Allocate agents to shift blueprints that cover Erlang requirements, then produce a weekly roster.

**Shift blueprints (defaults)**

| Blueprint | Window | Productive hrs | Type |
|---|---|---|---|
| Standard Day | 08:00–18:30 | 9 | FT |
| Mid Shift | 12:00–20:30 | 7 | FT |
| Morning Peak | 08:00–13:00 | 4 | PT |
| Afternoon Peak | 15:00–20:00 | 4 | PT |

- Custom shift creation: name, start, duration, FT/PT
- Capacity scenario slider (e.g., 100% rostered vs −5% deficit stressor)
- Coverage chart: Active Scenario Staff vs Baseline vs Sizing Required
- Diagnostics: understaffed / overstaffed interval hours
- Weekly employee-level roster table + **Export Full Roster CSV**

**Acceptance criteria**

- Stressor scenario visibly degrades estimated SLA/ASA when capacity drops.
- Under-coverage intervals are counted and highlighted.
- Roster export includes Agent, Channel, Day, Shift, Start/End.

---

### 6.7 Step 7 — Queue Simulation (SLA Verification)

**Purpose:** Independently verify roster performance via Poisson / Monte Carlo queue simulation.

**Controls**

- Channel selector
- Date period filter
- Monte Carlo sample size (e.g., 150 iterations)

**Outputs**

- Simulated SLA % over intervals vs target threshold
- KPI cards: Overall SLA %, ASA, Abandon Rate, Agent Occupancy (vs targets / max safe)
- Interval telemetry log: Volume, Agents Available, SLA, ASA, Abandon %, Occupancy %

**Acceptance criteria**

- Simulation uses rostered agents, not only Erlang theoretical staff.
- Occupancy / abandon breaches are visually flagged against targets.
- Certification unlocks Cost Report.

---

### 6.8 Step 8 — Cost Analysis & Export

**Purpose:** Produce the financial view of the completed plan and export artifacts.

**Inputs**

- Standard loaded wage ($/hr)
- Overtime penalty multiplier (e.g., 1.5×)

**Outputs / KPIs**

- Plan Budget  
- Cost / Contact  
- Roster Efficiency  
- Overall SLA %  

**Budget sheet columns**

- Month, Recruitment Cost, Training Cost, Base Wages, Overtime Penalty, Total Budget

**Exports (required)**

1. **Export Master Plan (Excel)** — integrated dashboard: hiring totals, forecast/sizing counts, grand total budget  
2. **Download Raw Summary (CSV)** — interval/detail metrics for downstream tools  
3. Roster CSV (from Step 6)

**Acceptance criteria**

- Wage / OT changes recalculate budget sheet dynamically.
- Master Plan opens in Excel-compatible format without the app.
- Final stage shows all 8 workflow gates verified.

---

## 7. Data Requirements

### Input CSV (historical telemetry)

| Field | Required | Notes |
|---|---|---|
| Date / timestamp | Yes | Fuzzy-matched; interval granularity preferred (e.g., 30 min) |
| Volume | Yes | Interactions per interval |
| AHT | Yes | Seconds; falls back to channel Default AHT if missing after map |
| Interval / time | Preferred | Needed for intraday sizing |
| Channel | Preferred | Multi-channel plans |

**Quality guidance:** ≥ ~28 days recommended for Prophet-style models.

### Generated sample data

- ~30 days of synthetic multi-interval volumes with daily/weekly seasonality
- Suitable for demos and UAT without production extracts

### Persistence (prototype)

- In-browser planning state for the active session (certified steps, datasets, results)
- No requirement for server-side multi-user persistence in v1 prototype

---

## 8. UI / UX Requirements

1. **Sequential left-nav workflow** with complete / current / locked states — not a free-form tab bar that hides progress.
2. **One primary action per screen** (Continue / Run / Export); secondary actions visually subordinate.
3. **Inline plain-language help** for SLA, ASA, AHT, shrinkage, occupancy, adherence, Erlang variants.
4. **Units always visible** (seconds, %, FTE, $/hr).
5. **Certification gates** with clear copy when the next stage is locked.
6. **Visible warnings** for training bottlenecks, under-coverage, and off-target simulation KPIs.
7. **Preset-first onboarding** so a new planner can reach a full plan without blank-slate configuration.
8. **Charts + tables** for each analytical stage; both views available where density requires it.

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Correctness | Staffing KPIs for a selected model must come from that model (no display-only approximation that disagrees with the decision number) |
| Transparency | Recommended algorithms and fallbacks are labeled in UI |
| Performance | Interactive runs for 30–90 day interval datasets without freezing the UI; long sims show progress or complete in background |
| Usability | New planner completes sample-data → export path in one guided session |
| Export fidelity | Excel/CSV artifacts match on-screen totals for the certified plan |
| Security (prototype) | No requirement to store PII; agent IDs in rosters may be synthetic |
| Offline note | Simulation copy references offline processing; production desktop track may enforce zero-network CI separately |

---

## 10. Domain Algorithms (product-level)

These are product capabilities, not implementation prescriptions:

- **Cleansing:** IQR / Z-score / MAD / sigma with configurable sensitivity  
- **Forecasting:** averages, Holt-Winters, Prophet-style additive decomposition, SARIMA, Croston, ensemble  
- **Sizing:** Erlang A/B/C, concurrency, backlog workload  
- **Staffing buffers:** shrinkage and adherence inflate raw Erlang to final roster requirement  
- **Hiring:** lead-time pipeline with attrition, graduation yield, classroom/trainer constraints, OT gap fill  
- **Scheduling:** blueprint-based coverage against interval requirements  
- **Simulation:** Poisson / Monte Carlo interval SLA, ASA, abandon, occupancy  
- **Cost:** loaded wage × hours + recruitment + training + OT penalty → plan budget and cost/contact  

---

## 11. System Context (implementation tracks)

```
┌─────────────────────────────────────────────────────────────┐
│ Google AI Studio Prototype (workforce-planner.ai.studio)    │
│  React SPA · client-side planning engine · Excel/CSV export │
└─────────────────────────────┬───────────────────────────────┘
                              │ product definition / UX source
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ WFM Planning Suite (this repository)                        │
│  core/  — Erlang, forecast, cleanse, schedule, simulate     │
│  web/   — browser UI pipeline                               │
│  ui/    — optional desktop (PySide6) track                  │
│  tests/ — tiered validation                                 │
└─────────────────────────────────────────────────────────────┘
```

**Guiding engineering tenets for the repo implementation**

1. One formula, one home (no duplicate Erlang / date parsers).  
2. Displayed KPI and decision KPI are the same number.  
3. No silent fallbacks — surface approximations.  
4. Core logic UI-independent and unit-testable.  
5. Simple by default; advanced model controls available but recommended defaults are clear.

---

## 12. Success Metrics

- Planner completes all 8 gates on sample data and exports Master Plan without external help.
- Preset load + sample generate path produces a coherent Voice plan (sizing, roster, budget) in one session.
- Changing SLA/shrinkage in Profile or Sizing visibly changes hiring and cost outcomes.
- Simulation KPIs respond to −5% capacity stressor with measurable SLA/abandon degradation.
- Export totals reconcile to on-screen Plan Budget within rounding tolerance.

---

## 13. Milestones

| Phase | Scope |
|---|---|
| **P0 — Spec lock** | This PRD reviewed against AI Studio prototype; gaps logged as issues |
| **P1 — Parity checklist** | Repo web/desktop features mapped 1:1 to Steps 1–8 (presets, sample data, hiring, cost export) |
| **P2 — Correctness** | Tiered tests for cleansing distinctness, Erlang A/B/C, forecast selection labeling, sim vs analytic sanity |
| **P3 — UX polish** | Certification copy, warning badges, unit labels, advanced/simple disclosure |
| **P4 — Pilot** | Parallel-run against incumbent spreadsheet process on real interval history |

---

## 14. Open Questions / Risks

1. **Chat source access:** Gemini build chat is auth-gated; any requirements that lived only in chat (and not in the live app) need owner paste/export to reconcile.
2. **Outbound channel:** Present in later stages; confirm whether Profile Setup must expose full Outbound parameter defaults like other channels.
3. **Simulation vs hiring scale:** Sample runs can show severe SLA shortfalls when starting headcount ≪ Erlang demand — product should clarify “illustrative deficit” vs “operationally ready plan.”
4. **Desktop vs web primacy:** AI Studio prototype is web; repo also maintains offline desktop goals — decide which is source of truth for UX copy and stage naming.
5. **Model fidelity:** Prophet/SARIMA labels in the prototype may be simplified approximations; production track must either implement true models or rename methods to avoid overclaiming.

---

## 15. Glossary

| Term | Definition |
|---|---|
| SLA | % of contacts answered within the time threshold |
| ASA | Average speed of answer (mean queue wait) |
| AHT | Average handle time |
| FTE | Full-time equivalent staffing unit |
| Shrinkage | Share of paid time not available for handling |
| Adherence | Share of scheduled time agents actually work as rostered |
| Occupancy | Share of logged-on time spent handling contacts |
| Erlang A/B/C | Classic queueing staffing models (abandon / block / delay) |
| Monte Carlo | Repeated random simulation to estimate service metrics |

---

## Appendix A — Reference Links

- Live app: https://workforce-planner.ai.studio  
- AI Studio app: https://ai.studio/apps/024f1936-c4a8-404f-8ec0-61b485605607  
- Related docs in repo: `docs/architecture.md`, `docs/user_guide.md`, `docs/validation_framework.md`, `docs/WEB_ACCESS.md`

## Appendix B — Default Voice Parameter Snapshot (prototype)

| Parameter | Default |
|---|---|
| Target SLA | 80% in 20s |
| ASA | 30s |
| Answer % | 95% |
| Max occupancy | 85% |
| Shrinkage | 30% |
| Adherence | 90% |
| Default AHT | 280s |
| Daily / weekly / monthly productive limits | 8 / 40 / 160 hrs |

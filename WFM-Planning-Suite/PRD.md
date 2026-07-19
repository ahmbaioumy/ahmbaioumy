# Product Requirements Document — Contact Center Workforce Planning Studio

**Product name:** Workforce Studio — Planner Edition  
**Version reference:** 2.7.3 (AI Studio prototype)  
**Status:** Draft v2.1  
**Last updated:** 2026-07-19  

**Source & provenance**

| Source | URL | Status |
|--------|-----|--------|
| Gemini chat (AI Studio) | https://ai.studio/apps/024f1936-c4a8-404f-8ec0-61b485605607 | Read — requirements captured in Section 16 |
| Live prototype | https://workforce-planner.ai.studio | Verified — all 8 workflow steps explored |
| Reference source code | `WFM-Planning-Suite/gemini-studio/` | Downloaded from AI Studio export (33 files) |

This PRD synthesizes the **Gemini conversation**, the **live prototype**, and the **exported reference implementation**. Where the existing `WFM-Planning-Suite` repo (`web/`, `src/`) diverges, this document reflects the Gemini-built product as the target definition.

---

## 1. Product Vision & Problem Statement

### Vision

A single, guided workforce-planning studio that takes a contact-center planner from operational configuration through historical telemetry ingestion, statistical cleansing, demand forecasting, Erlang-based staffing, capacity hiring, shift scheduling, queue simulation, and cost export — with every staffing number traceable to the assumptions and formulas that produced it.

### Tagline (from prototype)

> "Welcome to the Workforce Planning Engine. As a planner, you can simulate and schedule shifts perfectly across multiple transaction channels. Configure targets below, load standard templates, and complete the end-to-end operational pipeline step-by-step."

### Problem

Contact-center workforce planning is typically fragmented across spreadsheets, standalone Erlang calculators, and enterprise WFM suites. Planners lack a single tool that:

- Unifies **multi-channel** planning (voice, chat, email, social, escalation, outbound)
- Handles **real-world dirty data** (outages, spikes, missing intervals)
- Connects **forecast → sizing → hiring → scheduling → simulation → budget** in one pipeline
- Surfaces **recommendations** without requiring queueing-theory expertise
- Runs **offline / locally** so telephony data never leaves the organization

### What "done" looks like

A WFM analyst configures channel SLAs and business windows, uploads (or generates) 30-day interval telemetry, walks through eight gated workflow steps, and exports a master Excel plan plus CSV summaries — with green verification banners at each gate confirming the pipeline is internally consistent.

---

## 2. Goals & Non-Goals

### Goals

| # | Goal |
|---|------|
| G1 | **End-to-end pipeline:** Profile → Historical & Cleansing → Forecast → Erlang Sizing → Capacity Hiring → Shift Scheduling → Queue Simulation → Cost Analysis & Export |
| G2 | **Multi-channel support:** Voice, Live Chat, Email, Social & Messaging, Complaints Escalation, Outbound Campaigns — each with independent SLA parameters |
| G3 | **Preset templates** for common operating models (voice-heavy, digital concurrency, elite SLA, email backlog) |
| G4 | **Data quality layer** with selectable anomaly detection and imputation methods |
| G5 | **Intelligent recommendations** — context-aware "Best Recommendation" prompts (IQR cleansing, Prophet forecasting, Erlang C for voice) |
| G6 | **Gated sequential workflow** — steps unlock only after prior steps are verified |
| G7 | **Offline-first operation** — "100% Offline Local Model"; no server dependency at runtime |
| G8 | **Auditable outputs** — interval-level tables, charts, and exportable workbooks |

### Non-Goals (v1)

| # | Non-goal |
|---|----------|
| NG1 | Live ACD/CTI/telephony integration (file upload and sample-data generation only) |
| NG2 | Multi-tenant SaaS / multi-site enterprise deployment |
| NG3 | Real-time intraday re-forecasting or automated schedule re-optimization |
| NG4 | Agent-level HR/payroll system integration beyond export files |
| NG5 | Full Erlang X / Erlang O / blended-queue theory before A/B/C are validated |

---

## 3. Users & Personas

| Persona | Role | Primary needs |
|---------|------|---------------|
| **WFM Planner / Analyst** | Runs weekly/monthly planning cycles | Fast path from telemetry to staffing plan; preset templates; guided recommendations |
| **WFM Manager / Ops Lead** | Reviews and approves plans | One-page budget summary, SLA risk flags, hiring roadmap |
| **Capacity / HR Partner** | Plans recruitment and training | Hiring funnel metrics, class sizing, lead-time modeling, bottleneck alerts |
| **Finance / FP&A** | Validates labor cost | Monthly budget allocation, cost-per-contact, overtime penalty modeling |

---

## 4. Guiding Principles

1. **One formula, one home** — Erlang, forecasting, cleansing, and simulation logic each have a single implementation; UI only renders results.
2. **Displayed number = decision number** — KPIs shown beside staffing figures must come from the same model that produced those figures.
3. **No silent fallbacks** — default AHT, flat intraday patterns, or degraded forecast methods are visibly labeled in UI and exports.
4. **Offline by construction** — zero runtime network calls in the shipped product.
5. **Progressive disclosure** — sensible defaults and preset templates for novices; full algorithm selection for power users.
6. **Hybrid certification** — critical computation steps (forecast, sizing, simulation, cost) require explicit user review via orange "Please Review & Certify" banners; profile setup and data ingestion auto-certify via `useEffect` observers when valid state is detected (per Gemini chat).
7. **Recommendation, not mandate** — system suggests IQR, Prophet, Erlang C, etc., but the planner can override.
8. **Navigation-bound state saving** — clicking "Continue to Forecasting" (and equivalent CTAs) must propagate cleansed volume and AHT into the global forecasting model without data loss.

---

## 5. Pipeline Overview

```
┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│ 1. Profile      │───▶│ 2. Historical &      │───▶│ 3. Forecast        │
│    Setup        │    │    Cleansing         │    │    Generation      │
└─────────────────┘    └──────────────────────┘    └────────────────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│ 4. Erlang       │───▶│ 5. Capacity          │───▶│ 6. Shift           │
│    Sizing       │    │    Hiring            │    │    Scheduling      │
└─────────────────┘    └──────────────────────┘    └────────────────────┘
         │                        │                          │
         ▼                        ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│ 7. Queue        │───▶│ 8. Cost Analysis     │
│    Simulation   │    │    & Export          │
└─────────────────┘    └──────────────────────┘
```

**Navigation:** persistent left sidebar with step indicators (complete ✓ / active / locked).  
**Status:** top-right "Operational Planning State Ready" indicator.

---

## 6. Functional Requirements — by Stage

### 6.1 Step 1 — Profile Setup

**Purpose:** Define operational windows, labor-hour limits, per-channel SLA targets, and sizing safety buffers.

#### 6.1.1 Planner Preset Templates

| Template | Description |
|----------|-------------|
| Standard Voice-Heavy | SLA 80/20, voice baseline, moderate digital |
| Digital Concurrency | High Chat & Social, multi-session agents |
| Elite SLA Target | SLA 90/10, high-occupancy ceiling |
| Minimal Backlogs | Workload email, lower SLA thresholds |

Selecting a preset populates channel parameters; user may override any value.

#### 6.1.2 Business Window & Labor Hours

| Parameter | Default | Control |
|-----------|---------|---------|
| Open Time | 08:00 | Time picker |
| Close Time | 20:00 | Time picker |
| Business Days | Mon–Fri | M T W T F S S toggle buttons |
| Daily Productive Limit | 8 hrs | Slider + "set limit" |
| Weekly Contract Limit | 40 hrs | Slider + "set limit" |
| Monthly Work Limit | 160 hrs | Slider + "set limit" |

*Help text:* "Target net hours on-line exclusive of lunches, long meetings, etc."

#### 6.1.3 Channel SLA & Staffing Parameters

Six channel tabs: **Voice Inbound**, **Live Chat**, **Email Support**, **Social & Messaging**, **Complaints Escalation**, **Outbound Campaigns**.

Per-channel metrics (defaults from prototype):

| Channel | SLA % | SLA Threshold | ASA Target | Answer % |
|---------|-------|---------------|------------|----------|
| Voice Inbound | 80% | 20s | 30s | 95% |
| Live Chat | 85% | 45s | 40s | 92% |
| Email Support | 95% | 1800s (30 min) | 300s | 99% |
| Social & Messaging | 90% | 60s | 60s | 94% |
| Complaints Escalation | 95% | 3600s (1 hr) | 600s | 98% |
| Outbound Campaigns | *(configurable per preset)* | | | |

Field descriptions:

- **Target Service Level % (SLA):** Percent of interactions answered within the target threshold.
- **SLA Time Threshold:** Response time target (e.g., 20s for Voice, 45s for Live Chat).
- **Average Speed of Answer (ASA) Target:** Target average wait time for customers in queue.
- **Answer Percentage (Min Target):** 100% minus maximum acceptable abandonment or busy rate.

#### 6.1.4 Sizing Safety Buffer Targets (global)

| Parameter | Default | Description |
|-----------|---------|-------------|
| Maximum Agent Occupancy | 85% | Limits burnout; max % of logged-on time spent talking/handling |
| Total Channel Shrinkage | 30% | Total off-line time (sick, coaching, breaks, vacations) |
| Schedule Adherence Target | 90% | Estimated % of agents working precisely when rostered |
| Default AHT Reference | 280s (voice preset) / 650s (multi-channel) | Fallback handling time if not uploaded |

#### 6.1.5 Acceptance Criteria

- [ ] Green banner: "Step 1: Channel Settings Verified"
- [ ] "Continue to Data Ingestion" unlocks Step 2
- [ ] All six channel tabs retain independent parameter sets
- [ ] Preset templates load without overwriting user-confirmed values without confirmation

---

### 6.2 Step 2 — Historical & Cleansing

**Purpose:** Ingest contact-center interval telemetry, detect anomalies, impute gaps, and produce cleansed volume profiles.

#### 6.2.1 Data Ingestion

| Method | Behavior |
|--------|----------|
| Drag & drop CSV | Automatic fuzzy header matching and preview mapper |
| Browse Files | Standard file picker |
| Generate Sample Data | Synthetic 30-day interval dataset (prototype: 8,640 records) |

*Preferred columns hint:* Interval, timestamp, inbound volume, channel, AHT (when available).

#### 6.2.2 Cleansing Algorithms

| Method | Description |
|--------|-------------|
| Z-Score Standard Deviation | Identifies spikes outside standard deviation limits |
| Interquartile Range (IQR) | Robust outlier clipping; **recommended default** for moderate dispersion |
| Rolling Median (MAD) | Smooths local variance but preserves cyclical peak shapes |
| No Cleansing (Keep Raw) | Bypass cleansing; raw data feeds downstream |

**Anomaly Sensitivity Threshold:** adjustable sigma (default 2.5σ). Lower = more aggressive flagging.

#### 6.2.3 Imputation Methods

| Method | Description |
|--------|-------------|
| Rolling Mean (Average) | Replaces missing/anomalous data with historical average of the interval slot |
| Rolling Median | Replaces with median; resistant to extreme skews |
| Forward Fill (Prev Value) | Copies immediately preceding valid reading |
| Constant Zero Drop | Sets anomalous intervals to 0 |
| No Replacement (Keep Spikes) | Flags anomalies but preserves raw spikes |

#### 6.2.4 Data Profiler & Inventory

- **Transaction Telemetry Profiler** — area chart: Cleansed Volume (solid) vs Raw Volume (dashed)
- **Time granularity tabs:** Hourly/Interval, Daily, Weekly, Monthly, Yearly
- **Channel tabs:** Voice, Chat, Email, Social, Complaints, Outbound
- **View modes:** Chart Only, Table Only, Both

**Aggregated Workload Inventory table columns:**

| Column | Description |
|--------|-------------|
| Period Label | HH:MM or date |
| Raw Ingest Volume | Pre-cleansing count |
| Cleansed Volume | Post-cleansing count (clickable) |
| Average AHT (s) | Mean handle time |
| Anomalies Logged | Count of flagged outliers |

- **Detected Outlier Registry** — sidebar list with channel, timestamp, raw vs cleansed values, anomaly reason (e.g., "Campaign traffic spike")
- **Status display:** Total Records, Anomaly count and %

#### 6.2.5 Acceptance Criteria

- [ ] Sample data generates ≥8,000 interval records with realistic anomaly rate (~0.6%)
- [ ] IQR recommendation box appears with one-click "Apply Recommended Method"
- [ ] Cleansed vs raw comparison visible per channel
- [ ] "Continue to Forecasting" unlocks Step 3

---

### 6.3 Step 3 — Forecast Generation

**Purpose:** Project future interaction volume from cleansed history.

#### 6.3.1 Planning Horizon

| Option | Use case |
|--------|----------|
| 7-Day Plan | Short-term tactical |
| 30-Day Plan | Monthly cycle (default) |
| 90-Day Plan | Quarterly planning |
| Yearly Plan | Annual capacity |

#### 6.3.2 Forecasting Models

| Model | Description |
|-------|-------------|
| Simple Interval Average | Baseline static average of matching slots |
| Day-of-Week Moving Avg | Averages recent weekdays; good for volatile short runs |
| Linear Growth Trend Projection | Fits linear regression across history |
| Double Holt-Winters Seasonal | Blends growth momentum and cyclic weekly patterns |
| Prophet Additive Decomposition | Isolates global growth, weekday weights, intraday peaks — **recommended when ≥28 days history** |
| SARIMA Autoregressive Lag | Blends weekday cycle lags and linear trend coefficients |
| Croston Intermittent-Demand | Separates demand size and spacing; ideal for sparse channels |
| Consensus Ensemble Blend | Blend of Holt-Winters, Prophet, and Moving Average |

#### 6.3.3 Diagnostics & Output

- **Cleansed Data Diagnostics** info box with model recommendation
- **Volume Transition Curve** — dual-line chart: Actual Ingest Volume vs Forecast Volume
- **Forecast Output Grid** — Period Label, Actual Volume, Projected Volume, Variance/Difference
- Date range filters (FROM / TO)
- Per-channel and per-granularity views

#### 6.3.4 Acceptance Criteria

- [ ] Green banner: "Step 3: Forecast Workload Trends Verified"
- [ ] Orange gate: "Please Review & Certify Forecast Trends above to unlock Sizing & Erlang Models"
- [ ] Prophet recommended automatically when sample size ≥28 days
- [ ] "Continue to Sizing" unlocks Step 4 after certification

---

### 6.4 Step 4 — Erlang Sizing

**Purpose:** Convert forecast demand into required staffing per interval using queueing models.

#### 6.4.1 Staffing Models

| Model | Use case |
|-------|----------|
| Erlang C (Queue Delay) | Standard queuing for voice calls — **recommended for high-volume voice** |
| Erlang A (Abandonments) | Factors customer patience and dropout |
| Erlang B (Blocking Limit) | Blocking ratio / busy signals |
| Blended Task Concurrency | Multi-session chat agents |
| Workload Sizing (Backlog) | Direct FTE: volume × handling time ÷ duration (email/async) |

#### 6.4.2 Active Channel Adjustments

Editable per run: Target SLA %, SLA Time (s), Shrinkage %, Adherence %.

#### 6.4.3 Output

- **Staffing Requirements Curves** — dual-line chart: Raw Queue Required Agents vs Shrinkage & Adherence Adjusted Staff
- **Interval Sizing Roster** table:

| Column | Description |
|--------|-------------|
| Period Label | HH:MM |
| Summed Volume | Interval call/interaction count |
| Workload (Hrs) | Erlang workload hours |
| Average Raw Erlang | Pre-buffer agent count |
| Average Final Required Staff | Post-shrinkage/adherence count |

#### 6.4.4 Acceptance Criteria

- [ ] Green banner: "Step 4: Erlang Sizing Requirements Verified"
- [ ] Erlang C recommended for voice with active queue
- [ ] Final staff = f(raw Erlang, shrinkage, adherence) — values visible per interval
- [ ] Orange gate before Capacity Planning unlocks

---

### 6.5 Step 5 — Capacity Hiring

**Purpose:** Translate staffing deficits into a recruitment and training roadmap with cost implications.

#### 6.5.1 Hiring Pipeline Metrics (summary cards)

| Metric | Example (prototype) |
|--------|---------------------|
| Total New Hires | 180 FTE |
| Acquisition Cost | $270,000 |
| Training Classes | $102,000 |
| Total Plan Budget | $61,771,680 |

#### 6.5.2 Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Starting Headcount (FTE) | 45 | Rostered staff active on day 1 |
| Sourcing Lead Time | 4 weeks | Recruitment pipeline |
| Training Lead Time | 4 weeks | Classroom duration |
| Nesting Lead Time | 2 weeks | Post-training ramp |
| Graduation Throughput Rate | 85% | Training completion rate |
| Active Monthly Attrition | 3% | Ongoing turnover |
| Max Class Cohort Size | 15 agents | Per-class capacity |
| Available Rooms | 2 | Training room count |
| Available Trainers | 2 | Trainer headcount |
| Loaded Hourly Wage | $24/hr | Fully loaded labor rate |
| Recruitment Cost/Hire | $1,500 | Per-hire acquisition |

#### 6.5.3 Six-Month Capacity Hiring Roadmap

Automatic optimization produces monthly table:

| Column | Description |
|--------|-------------|
| Month | Planning month |
| Target Sizing (FTE) | Erlang-derived requirement |
| Starting FTE | Month-opening headcount |
| Attrition Loss | Expected departures |
| New Cohort Needed | Required hires (e.g., "+30 hires") |
| Ending FTE | Month-close headcount |
| Deficit (OT) | Overtime-covered gap (red when negative) |
| Month Cost | Total monthly labor + hiring cost |

#### 6.5.4 Alerts

- **Training Facility Bottleneck Detected** — when required hires exceed trainer/room capacity; remainder covered via OT
- **Workforce Dependency Alert** — cohort counts locked to Erlang curves; changing shrinkage/SLA recalculates hiring

#### 6.5.5 Acceptance Criteria

- [ ] Green banner: "Step 5: Capacity & Hiring Plan Verified"
- [ ] Bottleneck warning when class capacity insufficient
- [ ] "Continue to Shift Scheduler" unlocks Step 6

---

### 6.6 Step 6 — Shift Scheduling

**Purpose:** Build shift rosters that cover interval staffing requirements.

#### 6.6.1 Shift Roster Blueprints (presets)

| Blueprint | Hours | Productive hrs |
|-----------|-------|----------------|
| Standard Day (FT) | 08:00–18:30 | 8 |
| Mid Shift (FT) | 12:00–20:30 | 8 |
| Morning Peak (PT) | 08:00–12:00 | 4 |
| Afternoon Peak (PT) | 14:00–18:00 | 4 |

**Custom Shift creator:** name, start time, duration (hrs), FT/PT toggle.

#### 6.6.2 Capacity Scenario & Stressor

| Control | Behavior |
|---------|----------|
| Rostered Capacity Level | Slider 0–100%+ |
| Standard (100%) | Baseline scenario |
| Failure (-5% deficit) | Stress-test understaffing |

**Estimated Operational KPIs (live preview):**

- Service Level %
- Avg Speed of Answer (ASA)
- Answer Percentage

#### 6.6.3 Coverage Visualization

- **Interval Shift Staffing Coverage vs Erlang Sizing** — stacked bar chart per 30-min interval
  - Active Scenario Staff (blue)
  - Baseline Rostered (gray)
  - Sizing Required (tan)
- Per-channel and per-day-of-week tabs

#### 6.6.4 Roster Outputs

- **Roster Variance Diagnostics:** Understaffed Intervals (hrs/day), Overstaffed Intervals (hrs/day)
- **Rostered Shift Staff Allocation Summary** — headcount per blueprint
- **Weekly Employee-Level Shift Roster** — Agent ID, Channel, Mon–Fri shift assignments
- **Export Full Roster CSV**

#### 6.6.5 Acceptance Criteria

- [ ] Green banner: "Step 6: Shift Roster Verified"
- [ ] Under-coverage warning when intervals fall below Erlang requirement
- [ ] "Continue to Queue Simulation" unlocks Step 7

---

### 6.7 Step 7 — Queue Simulation

**Purpose:** Validate schedule performance via discrete-event / Monte Carlo simulation independent of analytic Erlang math.

#### 6.7.1 Simulator Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Channel Queue | Voice (etc.) | Per-channel simulation |
| Date Period | FROM / TO | Simulation window |
| Monte Carlo Sample Size | 150 iterations | Higher = finer SLA results, longer runtime |

#### 6.7.2 Output Metrics (summary cards)

| Metric | Target reference |
|--------|------------------|
| Overall SLA % | vs channel SLA target |
| Overall ASA | vs ASA target |
| Abandon Rate % | vs <5% target |
| Agent Occupancy % | vs max occupancy (85%) |

#### 6.7.3 Interval Simulation Telemetry Log

| Column | Description |
|--------|-------------|
| Interval | HH:MM |
| Volume | Interaction count |
| Agents Available | Scheduled agents |
| Simulated SLA % | Per-interval SLA |
| Simulated ASA | Seconds |
| Abandon Rate % | Per-interval abandonment |
| Agent Occupancy % | Utilization |

- **Simulated Interval Service Level %** line chart with target SLA threshold overlay

#### 6.7.4 Acceptance Criteria

- [ ] Green banner: "Step 7: SLA Simulation Verified" with overall SLA %
- [ ] Simulation runs fully offline
- [ ] Orange gate before Cost Analysis unlocks
- [ ] Analytic sizing and simulation results documented with expected tolerance

---

### 6.8 Step 8 — Cost Analysis & Export

**Purpose:** Produce financial summary and downloadable artifacts.

#### 6.8.1 Labor Cost Modeling

| Parameter | Default | Description |
|-----------|---------|-------------|
| Standard Loaded Wage | $24/hr | Benefits, taxes included |
| Overtime Penalty Rate | 1.5× | OT wage multiplier |

#### 6.8.2 Summary Metrics

| Metric | Description |
|--------|-------------|
| Plan Budget | Total program cost |
| Cost/Contact | Unit economics |
| Roster Efficiency | Schedule utilization |
| Overall SLA % | Simulation-derived SLA |

#### 6.8.3 Financial Budget Allocation Sheet

Monthly breakdown:

| Column | Description |
|--------|-------------|
| Recruitment Cost | New-hire acquisition |
| Training Cost | Classroom and trainer overhead |
| Base Wages | Contract labor salaries |
| Overtime Penalty | Gap coverage cost |
| Total Budget | Monthly total |

**Active Cost Adjustments** link for wage-multiplier what-if scenarios.

#### 6.8.4 Export Formats

| Export | Format | Contents |
|--------|--------|----------|
| Export Master Plan | Excel (.xlsx) | Complete planning workbook |
| Download Raw Summary | CSV | Tabular summary data |
| Export Full Roster CSV | CSV | Employee shift assignments (from Step 6) |

#### 6.8.5 Acceptance Criteria

- [ ] Green banner: "Step 8: Workforce Planning Cycle Verified & Approved"
- [ ] All 8 workflow gates show verified status
- [ ] Excel export is self-contained and readable without the app

---

## 7. UI/UX Requirements

### Navigation & Layout

- Persistent left sidebar: 8 steps with ✓ / active / locked states
- Two-column main content on Profile Setup (business params left, channel SLA right)
- Top-right operational status indicator
- Footer: version (2.7.3) and "100% Offline Local Model"

### Interaction Patterns

| Pattern | Rule |
|---------|------|
| Primary action | One blue CTA per screen ("Continue to …") |
| Sliders | All numeric targets use slider + optional "set limit" precision input |
| Recommendations | Blue info boxes with one-click "✓ Apply/Use recommended" links |
| Verification gates | Green success banners + orange "Please Review & Certify" warnings |
| Color semantics | Green = success/on-target; Blue = primary/active; Orange = action required; Red = deficit/off-target |
| Charts | Hover tooltips with timestamp, volume, SLA values |
| Tables | Paginated (e.g., 8 rows/page) with Prev/Next |

### Help & Jargon

Every visible domain term (SLA, ASA, AHT, Erlang A/B/C, shrinkage, occupancy, adherence, IQR, Prophet) has inline help text. A new analyst should not need external documentation for field meanings.

### Progressive Disclosure

- Preset templates provide fast start
- Advanced algorithm selection available but not default
- Stress scenarios (Failure -5% deficit) behind explicit toggle

---

## 8. Data Model

```
Profile
  ├── businessWindow (open, close, daysOfWeek)
  ├── laborLimits (daily, weekly, monthly productive hrs)
  ├── channels[] (name, slaPct, slaThreshold, asaTarget, answerPct)
  └── safetyBuffers (maxOccupancy, shrinkage, adherence, defaultAht)

RawTelemetry[] (interval, channel, volume, aht, timestamp)
  └──▶ CleansedTelemetry[] (+ anomalyFlags[], imputationMethod)

Forecast (horizon, model, series[])
  └──▶ IntervalDemand[] (period, actual, projected, variance)

SizingResult (model, channel, intervals[])
  └──▶ StaffingRequirement[] (rawErlang, finalStaff, workloadHrs)

CapacityPlan (headcount, leadTimes, attrition, classCapacity, monthlyRoadmap[])

Schedule (blueprints[], agentRoster[], coverageGaps[])

SimulationResult (iterations, intervals[], overallSla, overallAsa, abandonRate)

CostReport (monthlyBudget[], totalBudget, costPerContact, exports[])
```

Each entity is serializable independently for audit and partial re-run.

---

## 9. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Handle ≥8,640 interval records (30 days × 48 intervals × 6 channels) without UI freeze; long operations show progress |
| Offline | 100% local execution; no runtime network calls |
| Portability | Web: runs in browser with localStorage persistence; Desktop: single-file installer, no admin rights |
| Reliability | Auto-save profile and in-progress state; recoverable on relaunch |
| Security | No PII beyond agent identifiers; suitable for air-gapped environments |
| Accessibility | Sliders and toggles keyboard-accessible; sufficient color contrast for status indicators |

---

## 10. System Architecture (Target)

```
src/
├── core/                    # Pure calculation logic (no UI imports)
│   ├── datetime/            # Single date/interval parser
│   ├── cleansing/           # Z-Score, IQR, MAD strategies + imputation
│   ├── forecasting/         # 8 models + auto-selection + ensemble
│   ├── erlang/              # Erlang A/B/C + blended + workload sizing
│   ├── capacity/            # Hiring roadmap optimizer
│   ├── scheduling/          # Shift blueprint + roster optimizer
│   ├── simulation/          # Poisson DES / Monte Carlo engine
│   └── costing/             # Budget allocation + export generators
├── ui/                      # React (web) or PySide6 (desktop) — thin layer
├── io/                      # CSV/Excel import/export, profile persistence
└── main                     # Entry point
tests/                       # Mirrors core/ — Tier 1 exact-value, Tier 2 cross-validation
```

**Deployment targets:**

| Target | Stack | Status in repo |
|--------|-------|----------------|
| Web app | React + Vite + TypeScript (`web/`) | Partial — 8 stages, fewer features than prototype |
| Desktop app | Python + PySide6 (`src/`) | Partial — core pipeline without Capacity Hiring step |

---

## 11. Testing & Validation

### Tier 1 — Exact-value regression (every commit)

- Erlang A/B/C at multiple load levels
- Cleansing method distinctness (no two methods produce identical output)
- Date/interval parsing consistency
- Pipeline data conservation (no silent row loss)

### Tier 2 — Cross-validation (every PR)

- Analytic sizing vs simulation agreement within documented tolerance
- Boundary cases: zero volume, extreme spikes, missing fields
- Forecast accuracy on synthetic ground-truth patterns

### Tier 3 — Parallel-run validation (pre-production)

- 2–4 week parallel run against incumbent planning process
- Predicted vs actual SLA within ±5 percentage points

---

## 12. Gap Analysis — Prototype vs Current Repo

| Feature | Prototype (workforce-planner.ai.studio) | WFM-Planning-Suite repo |
|---------|----------------------------------------|-------------------------|
| Pipeline steps | 8 (includes Capacity Hiring) | 8 (Upload first; no Capacity Hiring) |
| Multi-channel SLA tabs | 6 channels with per-channel defaults | Single profile |
| Preset templates | 4 planner presets | None |
| Cleansing methods | 4 algorithms + 5 imputation options | Basic strategies |
| Forecast models | 8 models + ensemble | Auto-selector (fewer models) |
| Erlang models | 5 (A/B/C + blended + workload) | A/B/C |
| Capacity Hiring | Full 6-month roadmap + bottlenecks | Not implemented |
| Shift blueprints | 4 presets + custom | Basic optimizer |
| Queue simulation | Monte Carlo 150 iterations | DES engine |
| Cost export | Excel master plan + CSV | Basic report |
| Recommendation engine | Context-aware suggestions | None |
| Verification gates | Per-step certify banners | Simple step completion |

This gap analysis defines the implementation backlog for aligning the repo with the prototype.

---

## 13. Milestones

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **0 — Foundation** | Repo scaffolding, core/ui separation, CI | Tier 1 skeleton passes |
| **1 — Profile & Channels** | Multi-channel SLA, presets, business window | Step 1 matches prototype |
| **2 — Cleansing & Forecast** | Full algorithm set, profiler charts, recommendations | Steps 2–3 match prototype |
| **3 — Sizing & Capacity** | Erlang A/B/C + hiring roadmap | Steps 4–5 match prototype |
| **4 — Schedule & Simulate** | Shift blueprints, Monte Carlo, coverage charts | Steps 6–7 match prototype |
| **5 — Cost & Export** | Budget sheet, Excel/CSV exports | Step 8 match prototype |
| **6 — Parity & Pilot** | Gap analysis closed; Tier 3 parallel run | Production-ready sign-off |

---

## 14. Success Metrics

| Metric | Target |
|--------|--------|
| Tier 1 + Tier 2 tests | 100% passing in CI |
| Feature parity with prototype | ≥95% of PRD requirements implemented |
| New analyst time to export | Upload → master plan export in <20 minutes unassisted |
| Tier 3 SLA accuracy | ±5% vs actual over 4-week parallel run |
| Offline verification | Zero network calls in production code paths |

---

## 15. Open Questions

1. **Platform priority:** Should implementation target the web app (AI Studio prototype style) or continue PySide6 desktop-first? This PRD follows the web prototype; desktop remains a secondary deployment target.
2. **Erlang X / chat concurrency:** Blended Task Concurrency model exists in prototype UI — confirm mathematical specification before implementation.
3. **Currency/locale:** Prototype uses USD; confirm whether multi-currency is needed.
4. **Forecast results popup:** Chat requests a confirmation popup after forecast run — not yet implemented in reference source; confirm design.

---

## 16. Gemini Chat Requirements (Authoritative Product Intent)

Captured from the AI Studio conversation on 2026-07-19. These items reflect **what the product owner asked Gemini to build**, including features not yet in the reference source.

### 16.1 Auto-Validation & Flow Control

| Step | Auto-certify trigger | Notes |
|------|---------------------|-------|
| 0 — Profile Setup | On system boot / component mount | `useEffect` sets `certifiedSteps[0] = true` |
| 1 — Data Ingestion & Cleansing | Valid CSV uploaded or sample data generated | Unlocks Forecasting instantly |
| 2–4 — Forecast / Sizing | Manual certify banners remain | Orange gate before next step |
| 5 — Capacity & Hiring | Long-term hiring schedule calculated | Auto-certified when plan exists |
| 6 — Shift Scheduling | Shift allocations optimized | Auto-certified when roster exists |

Manual certification checkboxes were **removed** per chat — replaced by dynamic state observers.

### 16.2 CSV Ingestion — Flexible Schema

- **`interval` column is optional.** Parser fuzzy-matches headers: `time`, `slot`, `hour`, `interval`.
- If omitted, default interval `'00:00'` is assigned — records still cleanse and size correctly.
- **Date format validation** required during cleansing (chat: "check the date formate for cleansing").
- **Before/after display:** cleansing UI must show **raw vs cleansed** numbers side-by-side in tables, charts, and outlier registry.

### 16.3 Dynamic Imputation Engine

Post-anomaly treatment selector (radio panel) connected to `detectAndCleanseAnomalies`:

| Method | Behavior |
|--------|----------|
| Rolling Mean (Average) | Average across adjacent interval boundaries |
| Rolling Median | Local median; resistant to high-volatility spikes |
| Forward Fill | Last valid non-anomalous telemetry reading |
| Constant Zero Drop | Anomalous intervals set to zero volume |
| Keep Spikes | Flag in registry but preserve raw spike values |

Stateful: changing method updates graphs, statistics, and outlier registry in real time.

### 16.4 CustomRangeSlider Component

Replace all raw `<input type="range">` sliders with `CustomRangeSlider`:

- Inline editable **min/max boundary** fields ("set limit" toggle)
- Used for: SLA targets, ASA, shrinkage, anomaly sensitivity (1–3σ), class attrition, graduation throughput, capacity stress simulation

Reference: `gemini-studio/src/components/CustomRangeSlider.tsx`

### 16.5 Forecasting — Chat-Specified UX

- Planning horizon buttons: 7-day, 30-day, 90-day, yearly
- **Date FROM / TO pickers** alongside horizon presets (chat requirement — partial in reference source)
- **Results popup** after "Run Forecast Computations" completes (chat requirement — not yet in source)
- Cleansed data automatically feeds forecast on "Continue to Forecasting"

### 16.6 Capacity Planning — Business Logic (from chat)

**Starting point:** current manpower on the ground + monthly attrition %, compared against Erlang sizing requirements.

**Worked example (from chat):**

```
Current HC:     100 staff
Attrition:      10%/month
Target req:     125 FTE
Month-1 net:    100 × 90% = 90 active after attrition
Deficit:        125 − 90 = 35 → must hire/source 35
```

**Pipeline after capacity approval:**

1. Calculate sourcing volume accounting for training attrition, graduation throughput %, nesting lead time, class size, rooms, trainers
2. If training capacity is insufficient → surface bottleneck warning; remainder covered via OT
3. Once plan reaches target headcount (e.g., 125 FTE) → pass approved roster to **monthly shift scheduling**
4. Run schedule against KPIs (SLA %, ASA, answer %) to validate achievement

Reference implementation: `gemini-studio/src/components/CapacityPlanning.tsx`

### 16.7 Scheduling → Simulation → Cost Chain

- Approved capacity headcount drives roster generation (not raw Erlang peak alone)
- Simulation uses rostered agents per interval/day-of-week against forecast volume
- Cost module multiplies recruitment + training + base wages + OT penalty from sizing curves

### 16.8 Known Bugs / Fixes Discussed in Chat

| Issue | Status |
|-------|--------|
| **Elite SLA preset** highlights business hours incorrectly (shows 24h instead of AM/PM window) | Fix required — preset loader in `App.tsx` |
| Quota limits during Gemini development iterations | N/A for shipped product |
| Data lost on page refresh (repo `web/` app) | `localStorage` only saves profile — full pipeline state must be persisted |

---

## 17. Reference Source Architecture (`gemini-studio/`)

Exported from AI Studio. React 19 + Vite 6 + TypeScript + Tailwind 4 + Recharts.

```
gemini-studio/
├── src/
│   ├── App.tsx                          # Global state, step nav, preset templates, certification
│   ├── types.ts                         # Domain types (HistoricalRow, SizingResultRow, etc.)
│   ├── components/
│   │   ├── Dashboard.tsx                # Step 1: Profile Setup + presets
│   │   ├── UploadCleansing.tsx          # Step 2: CSV ingest, cleansing, imputation
│   │   ├── Forecasting.tsx              # Step 3: Horizon + model selection
│   │   ├── SizingErlang.tsx             # Step 4: Erlang A/B/C + blended + workload
│   │   ├── CapacityPlanning.tsx         # Step 5: Hiring roadmap + bottlenecks
│   │   ├── Scheduling.tsx               # Step 6: Shift blueprints + roster
│   │   ├── Simulation.tsx               # Step 7: Monte Carlo queue sim
│   │   ├── CostAnalysis.tsx             # Step 8: Budget + Excel/CSV export
│   │   └── CustomRangeSlider.tsx        # Shared adaptive slider
│   └── utils/
│       ├── cleansingUtils.ts            # Anomaly detection + imputation
│       ├── forecastingUtils.ts          # 8 forecast models + auto-recommendation
│       ├── mathUtils.ts                 # Erlang A/B/C, workload sizing, DES
│       ├── aggregationUtils.ts          # Interval/daily/weekly rollups for charts
│       └── excelExportUtils.ts          # Master plan Excel workbook generator
├── package.json
└── metadata.json
```

**Domain types** (`types.ts`): `HistoricalRow`, `ForecastRow`, `SizingResultRow`, `CapacityMonthlyPlan`, `ScheduleAssignment`, `SimulationResult`, `CostAnalysisReport`

**Sizing pipeline** (`SizingResultRow`):

```
rawRequiredAgents → occupancyAdjusted → shrinkageAdjusted → finalRequiredAgents
```

---

## 18. Gap Analysis — Updated (post source export)

| Feature | Gemini source | Repo `web/` | Repo desktop `src/` |
|---------|--------------|-------------|---------------------|
| 8-step pipeline with Capacity Hiring | Yes | No (7 conceptual stages, no hiring) | No |
| Multi-channel SLA (6 channels) | Yes | Partial (single profile) | Partial |
| Preset templates | 4 | No | No |
| CustomRangeSlider | Yes | No | No |
| Optional CSV interval column | Yes | No | No |
| Raw vs cleansed display | Yes | Partial | Partial |
| 8 forecast models | Yes | Fewer | Fewer |
| Capacity hiring roadmap | Yes | No | No |
| Excel master plan export | Yes | No | Partial |
| Full pipeline localStorage | In-memory only | Profile only | File-based |
| Auto-certification useEffect | Yes | No | No |

**Recommended next step:** Port `gemini-studio/` into `WFM-Planning-Suite/web/` as the primary web implementation, preserving offline-first constraints and adding full state persistence.

---

## Appendix A — Prototype URL Reference

- **Live app:** https://workforce-planner.ai.studio
- **AI Studio project:** https://ai.studio/apps/024f1936-c4a8-404f-8ec0-61b485605607
- **Repo web deployment:** https://ahmbaioumy.github.io/ahmbaioumy/ (earlier iteration)

## Appendix B — Key Formulas Referenced

| Domain | Methods |
|--------|---------|
| Anomaly detection | Z-Score, IQR, MAD (Rolling Median) |
| Imputation | Rolling Mean, Rolling Median, Forward Fill, Zero Drop |
| Forecasting | Moving Average, Holt-Winters, Linear Regression, Prophet, SARIMA, Croston, Ensemble |
| Staffing | Erlang A (abandonment), Erlang B (blocking), Erlang C (queue delay), Workload FTE |
| Simulation | Poisson arrival process, Monte Carlo (default 150 iterations) |
| Costing | Loaded wage × hours + OT penalty (1.5×) + recruitment + training |

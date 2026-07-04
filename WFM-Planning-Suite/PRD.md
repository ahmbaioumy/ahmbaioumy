# Product Requirements Document — WFM Planning Suite

**Status:** Draft v1.0
**Owner:** [your name]
**Scope note:** This PRD assumes continuity with the existing product direction confirmed across prior audit work — an **offline-first, air-gapped-capable PySide6 desktop application**. "GitHub repository" in this document means where the source code and issue tracker live to support a **Cursor Cloud Agent** development workflow (Section 11) — it is not a proposal to move this to a hosted web app. If that assumption is wrong, everything downstream of Section 4 changes, so flag it now rather than after implementation starts.

---

## 1. Product Vision & Problem Statement

**Vision:** A single, trustworthy desktop application that takes a contact center from raw historical interaction data to a defensible staffing plan — upload, cleanse, forecast, size (Erlang), schedule, and simulate — with every number traceable to the formula and inputs that produced it, running entirely offline.

**The problem this solves:** Contact center WFM planning today typically happens in one of two unsatisfying places. Either it's fragmented across spreadsheets and ad-hoc Erlang calculators with no single source of truth — different sheets quietly using different abandonment assumptions, nobody able to say with confidence which number is "the" number — or it's on a full enterprise WFM suite (Aspect/Alvaria, NICE IEX, Verint, Calabrio) that is powerful but expensive, typically cloud-hosted (a hard blocker for organizations with data-residency or air-gap requirements), and scoped for large multi-site enterprises rather than a single planning team that needs a focused tool.

**What this product is for:** the middle ground — enterprise-grade queueing theory (Erlang A/B/C, discrete-event simulation, constraint-based scheduling) and enterprise-grade rigor about correctness and auditability, packaged as something one WFM analyst can install with no IT ticket and no data ever leaving the building.

**What "done" looks like:** a WFM analyst uploads a CSV of historical interval volumes, moves through five more guided screens, and gets a staffing plan and a one-page report — and everything in that report can be explained, re-derived, and defended in a COPC-style audit without anyone needing to open the source code.

## 2. Goals & Non-Goals

**Goals**
- One coherent, guided pipeline: **Upload → Cleanse → Forecast → Size → Schedule → Simulate → Report.**
- Fully offline operation — zero network calls in the shipped product, verified in CI, not just assumed by convention.
- **Single source of truth per calculation.** Exactly one implementation of date parsing, exactly one Erlang engine per model (A/B/C), exactly one abandonment formula per model — never two modules quietly computing the same thing two different ways.
- **No silent approximation.** Any time the system falls back to a default, an estimate, or a simplified method because the ideal path wasn't available, that fact is visible in the UI and recorded in the output.
- A UI a WFM analyst without a statistics background can use unassisted, with an advanced mode for power users who want algorithm-level control.
- Auditable output: every figure in a generated report links back to the method and inputs that produced it.

**Non-Goals (v1)**
- No live ACD/CTI/telephony integration. Input is file-based (CSV/Excel) by design — this keeps the "zero network calls" guarantee simple and honest.
- Not a multi-tenant or multi-site SaaS product. Single-installation, single-organization desktop deployment.
- No real-time intraday re-forecasting or automated re-optimization. This tool produces a plan; it does not continuously adjust one. (Worth revisiting in a future major version, explicitly out of scope here.)
- Not attempting to support every queueing variant on day one. Erlang A, B, and C must be unimpeachably correct before Erlang X, Erlang O, and chat/blended-queue heuristics get equal engineering investment.

## 3. Users & Personas

| Persona | Role | What they need from this tool |
|---|---|---|
| **WFM Planner/Analyst** (primary) | Runs the weekly/monthly planning cycle | Fast, trustworthy path from data to plan; doesn't want to relearn queueing theory to use it |
| **WFM Manager / Ops Lead** (secondary) | Reviews and signs off on the plan | A clear one-page summary and risk flags, not raw Erlang tables |
| **IT / Deployment Admin** (tertiary) | Installs and maintains the tool across the org | A single installer, no admin rights required, no network/firewall exceptions to request |

## 4. Guiding Principles — non-negotiable engineering tenets

These are stated as hard rules, not aspirations, specifically because every one of them corresponds to a real defect class found in the current codebase during forensic audit. They should be enforced in code review and, where possible, in CI.

1. **One formula, one home.** Every calculation — date parsing, an Erlang variant, an abandonment model — has exactly one implementation in `core/`. Every other module imports it. A second, independent implementation of the same formula anywhere in the codebase is a defect on sight, not a style preference.
2. **The displayed number and the decision number are the same number.** If a KPI is shown next to a staffing figure, it must come from the same model that produced that staffing figure — never a simpler approximation computed separately just for display.
3. **No silent fallbacks.** Any substitution of a default, an estimate, or a degraded method is surfaced to the user in the UI (a visible badge or note) and recorded in the output data — never only written to a log file nobody reads.
4. **Offline by construction.** No runtime network calls in the shipped product, enforced by a CI check that scans production code paths for networking imports, not left to convention.
5. **Core logic is UI-independent.** No calculation function requires a running PySide6 event loop to execute. Every pipeline stage's logic is a plain, importable, unit-testable function or class; the UI layer only calls it and renders the result.
6. **Simple by default, powerful on request.** The default screen for each stage shows what most planning sessions need. Anything specialized — algorithm choice beyond the recommended default, simulation RNG parameters, patience-distribution tuning — lives behind an explicit "Advanced" toggle and never clutters the primary flow.

## 5. Functional Requirements — by pipeline stage

Each stage below states its purpose, inputs/outputs, and the key requirements that matter most given what's failed before in similar tools.

### 5.1 Upload
- **Purpose:** ingest historical interaction volume (and optionally AHT, channel, skill) from CSV/Excel.
- **Inputs:** a file; a column-mapping step if headers don't match expected names.
- **Outputs:** a validated, canonicalized dataset with a single unambiguous date representation.
- **Key requirements:**
  - Date format is resolved **once**, from the whole file, using unambiguous rows (day-of-month > 12) to establish the convention before any ambiguous row is parsed — never a per-attempt hit-rate guess that can tie and silently default to the wrong convention.
  - Validation surfaces problems before the user proceeds: missing columns, negative volumes, duplicate timestamps, gaps in the date range — each with a specific, actionable message, not a generic "invalid file."
  - A data-quality summary (row count, date range, detected granularity, issues found) is shown and must be acknowledged before continuing.

### 5.2 Profile / Configuration
- **Purpose:** capture the planning assumptions — SLA target and time, AHT distribution, shrinkage, occupancy target, patience/abandonment assumption, operating hours, channel type.
- **Key requirements:**
  - Every numeric input shows its unit inline (seconds vs. minutes, % vs. fraction) — never bare numbers the user has to infer the unit of.
  - Sensible, labeled defaults for a first-time user (e.g., 80/20 SLA, 30% shrinkage) — but no default is silently substituted without being visible in the profile summary.
  - Profiles are named and reusable across planning cycles (matches existing profile JSON persistence).

### 5.3 Data Cleansing
- **Purpose:** detect and handle anomalies (outages, spikes, data-entry errors) before forecasting.
- **Key requirements:**
  - Every offered cleansing/imputation method must be genuinely distinct from every other offered method — no two differently-named options may silently execute identical logic.
  - Any method not fully implemented is not offered in the UI at all — no placeholder options that quietly downgrade to a simpler method.
  - The comparison view shows, per method, what changed (which rows, by how much) — not just a final number.

### 5.4 Interval Pattern
- **Purpose:** establish (or derive) the intraday/day-of-week shape used to convert coarser (daily+) forecasts into interval-level demand for sizing.
- **Key requirements:**
  - When real interval-level history exists, it is always preferred over any synthetic/flat distribution method.
  - When no interval history exists, the flat/equal-distribution fallback is used but is **visibly labeled** in the output (e.g., an `Interval_Method` field shown in the UI and in exports) — a user must never mistake an approximated intraday curve for a data-derived one.

### 5.5 Forecasting
- **Purpose:** produce a volume forecast at the granularity the user needs (interval/daily/weekly/monthly).
- **Key requirements:**
  - Model selection is automatic by default (best-fit by holdout accuracy) with the chosen model and its accuracy score always shown, not hidden.
  - Minimum-history fallbacks (e.g., insufficient months for full seasonal decomposition) use the best available method for the data actually present — never silently degrade to a flat-line forecast without flagging that this happened and why.
  - Forecast accuracy (WMAPE/MAPE, bias/tracking signal) is tracked over time as more actuals arrive, not just computed once at forecast time.

### 5.6 Sizing (Erlang)
- **Purpose:** convert forecast demand into a required staffing level per interval, using Erlang A/B/C (and, later, more advanced variants).
- **Key requirements:**
  - The algorithm actually selected for staffing (A/B/C/etc.) is the same algorithm whose formulas produce every displayed KPI for that row — SLA%, ASA, Abandonment% must all come from one coherent model per row, never a generic approximation layered on top regardless of algorithm.
  - Erlang C rows show exactly 0% abandonment, by definition — this is a built-in sanity check, not just an implementation detail.
  - Any assumption override (e.g., an occupancy floor preventing an unrealistically low value) is shown in the output, not silently applied.

### 5.7 Scheduling
- **Purpose:** turn interval staffing requirements into actual shift assignments, respecting labor constraints and cost.
- **Key requirements:**
  - When required coverage exceeds available/hired headcount, this is surfaced as a clear, correctly-worded warning tied to the specific dates/intervals affected — not a generic status message that may or may not match what the code actually checks for.
  - Any capacity constraint that forces under-coverage in a specific interval (e.g., a per-shift agent cap) is counted and reported, not silently absorbed.

### 5.8 Simulation
- **Purpose:** validate a proposed schedule via discrete-event simulation, independent of the analytic Erlang math, as a cross-check.
- **Key requirements:**
  - Simulation and analytic sizing results for the same scenario should agree within a documented, sanity-checked tolerance — a built-in cross-validation, not two disconnected calculations that happen to live in the same app.
  - Warm-up period is excluded from reported statistics (standard DES practice, already correctly implemented — preserve this).

### 5.9 Results / Reporting
- **Purpose:** produce the artifact a manager actually reads and a planner defends in a review.
- **Key requirements:**
  - One-click export to a self-contained report (PDF or Excel) readable without the app installed.
  - Every headline number in the report is traceable, on request, to the stage and method that produced it.

## 6. UI/UX Requirements — "simple" and "professional" made concrete

Vague simplicity goals don't survive contact with implementation, so this section states specific, checkable rules rather than adjectives.

- **Navigation:** a persistent left-side step indicator reflecting the pipeline stage (Upload → Cleanse → Forecast → Size → Schedule → Simulate → Report), showing complete/current/locked state clearly. Not a tab bar that hides where the user is in the process.
- **One primary action per screen.** Each stage has one clear "Next" action. Secondary options (re-run, adjust parameters, view details) are visually subordinate to it.
- **No unexplained jargon.** Every statistical or domain term visible in the UI (SLA, ASA, Erlang A vs. C, shrinkage, occupancy, patience) has an inline help affordance with a one-sentence plain-language explanation. A new analyst should never need to leave the app to look up what a field means.
- **Consistent units, always shown.** Every numeric field displays its unit next to the value (seconds, %, FTE) — never a bare number.
- **Visible approximation badges.** Any time Section 4's "no silent fallback" rule applies, the UI shows a small, calm (not alarming) badge or note explaining what was approximated and why — e.g., "Estimated intraday pattern — no historical interval data available for this period."
- **Consistent status coloring.** Green/amber/red used consistently across the app for on-target/at-risk/off-target — SLA gaps, coverage gaps, forecast accuracy — the same meaning everywhere, never overloaded.
- **Progressive disclosure.** Default view = what 80% of planning sessions need. An explicit "Advanced" toggle reveals algorithm selection, simulation parameters, and other power-user controls — never shown by default to a first-time user.
- **Fast path to report.** From a completed plan, generating the shareable report is one click, not a multi-step export wizard.

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Handles at least 2 years of 30-minute interval history (~35,000 rows) without UI freeze; long-running work happens on background threads with progress feedback |
| Portability | Single-file installer, no administrator rights required, runs on a locked-down corporate Windows image (matches existing lowest-privilege Inno Setup approach) |
| Reliability | No data loss on unexpected close — in-progress work auto-saves and is recoverable on relaunch |
| Observability | Every fallback/override/approximation is logged locally with enough detail to diagnose after the fact — fully local log files, no network telemetry |
| Security & compliance | No PII beyond what scheduling requires (agent identifiers should be pseudonymizable); zero outbound network calls; suitable for air-gapped/regulated environments by default, not as a special configuration |

## 8. System Architecture

Enforced separation, directly informed by what made the current codebase hard to verify:

```
src/
├── core/                  # Pure calculation logic. No PySide6 imports allowed — enforced by CI.
│   ├── datetime/          # THE single date-parsing utility. Everything else imports this.
│   ├── erlang/            # THE Erlang A/B/C engine. One implementation per model, period.
│   ├── cleansing/         # Anomaly detection + imputation strategies (each genuinely distinct)
│   ├── forecasting/       # Forecast models + selection logic
│   ├── sizing/            # Orchestrates core.erlang against forecast output
│   ├── scheduling/        # Constraint-based schedule optimization
│   └── simulation/        # Discrete-event simulation engine
├── ui/                    # PySide6 widgets only. Thin — calls core/, renders results, no business logic.
├── io/                    # File import/export, profile persistence
└── main.py                # Application entry point
tests/                     # Mirrors core/ structure 1:1 — every core module has a corresponding test module
```

**Why this split matters operationally:** it's what makes Section 10's automated testing possible at all (core logic must be callable without a GUI event loop to be unit-tested), and it's what makes Section 11's parallel-agent development workflow safe (agents working on `core/erlang/` and agents working on `ui/` can't collide, because the boundary is a real module boundary, not a convention).

## 9. Data Model (core entities)

`Profile` (SLA target/time, AHT distribution, shrinkage, occupancy, patience, operating hours) → `RawUpload` → `CleansedSeries` → `Forecast` → `IntervalDemand` → `SizingResult` → `Schedule` → `SimulationResult` → `Report`

Each arrow is a pipeline stage boundary (Section 5). Each entity should be serializable on its own, so any stage's output can be inspected, exported, or fed into a later stage independently — this is what "auditable" in Section 1 actually requires structurally.

## 10. Testing & QA Strategy

This product's correctness bar is a **three-tier validation framework**, not a single test pass, because staffing errors have direct customer-experience and cost consequences and no finite automated test suite can substitute for validation against real operating data:

- **Tier 1 — Exact-value regression tests.** Hand-derived and code-verified ground truth for each Erlang model at multiple load levels, date-parsing consistency across every stage, imputation-method distinctness, and pipeline data-conservation checks (no silent row/volume loss between stages). These run on every commit.
- **Tier 2 — Cross-validation and boundary tests.** The analytic Sizing engine and the DES Simulation engine checked against each other on the same scenario (they should agree, because they're modeling the same thing two independent ways); boundary/edge cases (zero volume, extreme spikes, missing fields, duplicate timestamps, year boundaries); forecast accuracy validated against a known synthetic ground-truth pattern, not just a bare accuracy score. These run on every PR before merge.
- **Tier 3 — Parallel-run validation.** Before any release is trusted to drive live staffing decisions, it runs alongside the existing planning process for a minimum of 2-4 weeks, comparing predicted vs. actual SLA/ASA/Abandonment at the incumbent process's staffing levels. This is the step that validates against real call patterns and real AHT distributions, which no synthetic fixture can fully replicate — and it is not optional for a tool whose output directly affects customer experience.

**CI gate:** no PR merges without Tier 1 and Tier 2 passing. No version is marked "production-ready" without a documented, signed-off Tier 3 result.

## 11. Repository Structure

```
/
├── README.md                    # what this is, how to run it, link to this PRD
├── PRD.md                       # this document
├── .cursor/
│   ├── environment.json         # Cloud Agent environment definition (Section 12)
│   └── rules/                   # persistent, version-controlled coding standards for agents
├── .github/
│   └── workflows/
│       ├── ci.yml                # lint + Tier 1/2 tests on every PR
│       └── nightly-tier2.yml     # full Tier 2 suite, including longer-running simulation cross-checks
├── src/                          # see Section 8
├── tests/
├── docs/
│   ├── architecture.md
│   ├── validation_framework.md   # full detail behind Section 10
│   └── user_guide.md
└── installer/                    # packaging config (Inno Setup or equivalent)
```

## 12. Working with Cursor Cloud Agents

This section is written against how Cloud Agents actually work as of mid-2026, not a generic description — worth re-checking Cursor's own docs before relying on any detail here if it's been a while, since this class of tool moves fast.

**How they actually operate:** a Cloud Agent clones this repo from GitHub into an isolated cloud VM, does its work on a dedicated branch, and opens a pull request when done — it never touches your local machine, and you can run several agents in parallel on different branches without them colliding. Since February 2026, agents also get a full desktop and browser in their VM ("Computer Use"), meaning an agent can actually launch this app, click through it, and visually verify a UI change did what it was supposed to — which matters directly for Section 6's requirements.

**Before assigning any work, set up the environment properly.** This is the single highest-leverage step — an agent that can edit files but can't run this app's test suite can't verify its own work, which is exactly the failure mode that produces PRs that look plausible but don't actually work. Define `.cursor/environment.json` (or a `.cursor/Dockerfile`) pinning the exact Python version, all dependencies (PySide6, the ML/forecasting stack, `pytest`), and a startup command that runs Tier 1 tests as a smoke check. Do this once, carefully, by hand — don't delegate the environment setup itself to an agent.

**Structure work as GitHub issues, not as this whole PRD handed to one agent.** Cloud Agents do best on well-defined, objectively-verifiable, self-contained tasks — "implement TEST-02 from the validation framework and make it pass," not "build the sizing module." Break each functional requirement in Section 5 and each architectural boundary in Section 8 into individually-scoped issues, each stating its own acceptance test explicitly. A useful convention: tag issues `agent-ready` once they're scoped tightly enough for autonomous pickup, and leave larger design decisions as human-only issues.

**Parallelize along the module boundaries Section 8 defines.** Because `core/erlang/`, `core/datetime/`, and `ui/` are genuinely separate boundaries (not just folders), separate agents can safely work on "consolidate all Erlang math into core/erlang/" and "rebuild the step navigator per Section 6" at the same time, on separate branches, without stepping on each other.

**Gate every agent PR on the Tier 1/2 suite — no exceptions.** Agents are capable but not self-skeptical by default; real-world reports consistently note agents can report a task complete when it isn't fully correct. The objective, automated Tier 1/2 test suite (Section 10) — not the agent's own summary of its PR — is what should actually decide whether a merge is safe.

**One open tradeoff worth deciding deliberately, not by default:** Cloud Agents require sending your code to Cursor's cloud during active development (Privacy Mode must be off for this workflow). That's a different question from whether the *shipped product* ever makes a network call (Section 4, Section 7) — the deployed app can remain fully air-gapped for end users even while the development process uses cloud-based agents. But given this project's air-gapped-by-default philosophy, it's worth an explicit, conscious decision by whoever owns this repo rather than assuming it's automatically fine — check Cursor's current enterprise/data-handling terms before committing the workflow if this is a concern.

## 13. Milestones / Phased Roadmap

| Phase | Scope | Notes |
|---|---|---|
| **0 — Foundation** | Repo scaffolding, `core`/`ui` separation, CI skeleton, `.cursor/environment.json` | Human-reviewed carefully — this sets the pattern every later agent-driven change follows |
| **1 — Consolidation** | Single Erlang engine, single date parser, single set of genuinely-distinct imputation methods | Directly resolves the highest-severity defects already identified; ideal first batch of `agent-ready` issues |
| **2 — Pipeline correctness** | Algorithm-aware KPI display, granularity handling, Tier 1/2 test suite fully implemented | Gate for calling any release candidate trustworthy |
| **3 — UI simplification** | Step navigator, tooltips, approximation badges, simple/advanced mode split | Good candidate for Computer-Use-verified agent work given visual acceptance criteria |
| **4 — Packaging & pilot** | Installer, then a real Tier 3 parallel-run before any team relies on this for live decisions | Not complete until the parallel-run is documented, not just until the code merges |

## 14. Success Metrics

- 100% of Tier 1 and Tier 2 validation tests passing in CI, continuously — not just once.
- Zero duplicate implementations of any calculation, checked automatically (a simple CI rule counting date-parsing and Erlang function definitions outside `core/`).
- Tier 3 pilot: staffing recommendations' predicted SLA within ±5 percentage points of actual achieved SLA over a 4-week parallel run.
- A new WFM analyst completes upload → report on a standard dataset in under 15 minutes, unassisted, in a UAT session.

## 15. Open Questions / Risks

- **Platform continuity:** this PRD assumes PySide6 desktop continues. If a local-web UI (e.g., a local server + browser UI) is ever preferred for easier UI iteration, that's a larger architectural decision this document doesn't currently cover — flag explicitly before starting Phase 3 if this is in question.
- **Cloud Agent data-handling tradeoff:** see Section 12's callout — decide deliberately, don't default into it.
- **Scope of queueing models:** Erlang X, Erlang O, and chat/blended-queue support are real, valuable features but are explicitly sequenced after A/B/C are unimpeachable (Section 2) — resist the temptation to parallelize this work before the foundation is solid.

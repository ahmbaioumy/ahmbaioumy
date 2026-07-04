"""Generate auditable planning reports."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from core.models import Forecast, Profile, Report, Schedule, SimulationResult, SizingResult


def build_report(
    profile: Profile,
    forecast: Forecast,
    sizing: SizingResult,
    schedule: Schedule,
    simulation: SimulationResult | None = None,
) -> Report:
    total_agents = max((r.agents_required for r in sizing.rows), default=0)
    avg_sla = sum(r.sla_pct for r in sizing.rows) / len(sizing.rows) if sizing.rows else 0.0

    sections = [
        {
            "title": "Executive Summary",
            "items": [
                {"label": "Profile", "value": profile.name},
                {"label": "Peak Agents Required", "value": total_agents, "unit": "FTE"},
                {"label": "Average SLA", "value": round(avg_sla, 1), "unit": "%"},
                {"label": "Forecast Model", "value": forecast.model_name},
                {"label": "Forecast WMAPE", "value": forecast.accuracy_wmape, "unit": "%"},
            ],
        },
        {
            "title": "Risk Flags",
            "items": [{"label": w, "value": "warning"} for w in schedule.warnings],
        },
    ]

    if simulation:
        sections.append({
            "title": "Simulation Cross-Check",
            "items": [
                {"label": "Simulated SLA", "value": round(simulation.sla_pct, 1), "unit": "%"},
                {"label": "Simulated ASA", "value": round(simulation.asa_seconds, 1), "unit": "sec"},
                {"label": "Cross-check", "value": "Passed" if simulation.cross_check_passed else "Review"},
            ],
        })

    traceability = {
        "peak_agents": {"stage": "sizing", "method": profile.erlang_model.value, "inputs": ["volume", "aht", "sla"]},
        "avg_sla": {"stage": "sizing", "method": profile.erlang_model.value, "inputs": ["agents", "traffic"]},
        "forecast": {"stage": "forecast", "method": forecast.model_name, "inputs": ["historical_volume"]},
    }

    return Report(
        title="WFM Planning Report",
        generated_at=datetime.now(),
        sections=sections,
        traceability=traceability,
    )


def report_to_export_dict(report: Report, sizing: SizingResult) -> dict[str, Any]:
    return {
        "sheets": {
            "Summary": [
                {"Metric": item["label"], "Value": item.get("value"), "Unit": item.get("unit", "")}
                for section in report.sections
                for item in section["items"]
            ],
            "Sizing": [
                {
                    "Timestamp": r.timestamp.isoformat(),
                    "Volume": r.volume,
                    "Agents": r.agents_required,
                    "SLA %": round(r.sla_pct, 2),
                    "ASA (sec)": round(r.asa_seconds, 2),
                    "Abandon %": round(r.abandonment_pct, 2),
                }
                for r in sizing.rows
            ],
        }
    }

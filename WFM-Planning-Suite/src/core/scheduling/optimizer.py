"""Constraint-based schedule generation from sizing requirements."""

from __future__ import annotations

from datetime import timedelta

from core.models import Schedule, ScheduleAssignment, SizingResult


def build_schedule(
    sizing: SizingResult,
    available_agents: int,
    shift_hours: float = 8.0,
) -> Schedule:
    assignments: list[ScheduleAssignment] = []
    coverage_gaps: list[dict] = []
    warnings: list[str] = []

    if not sizing.rows:
        return Schedule(assignments=[], coverage_gaps=[], warnings=["No sizing data to schedule"])

    peak = max(sizing.rows, key=lambda r: r.agents_required)
    if peak.agents_required > available_agents:
        warnings.append(
            f"Required coverage ({peak.agents_required} agents at {peak.timestamp}) "
            f"exceeds available headcount ({available_agents} agents)"
        )

    dates_seen: set[str] = set()
    for row in sizing.rows:
        date_key = row.timestamp.strftime("%Y-%m-%d")
        if date_key in dates_seen:
            continue
        dates_seen.add(date_key)

        required = row.agents_required
        assigned = min(required, available_agents)
        gap = required - assigned

        if gap > 0:
            coverage_gaps.append({
                "timestamp": row.timestamp.isoformat(),
                "required": required,
                "assigned": assigned,
                "gap": gap,
            })

        shift_start = row.timestamp.replace(hour=8, minute=0, second=0, microsecond=0)
        shift_end = shift_start + timedelta(hours=shift_hours)

        for i in range(assigned):
            assignments.append(
                ScheduleAssignment(
                    agent_id=f"AGENT_{date_key}_{i + 1:03d}",
                    shift_start=shift_start,
                    shift_end=shift_end,
                )
            )

    if coverage_gaps:
        warnings.append(f"{len(coverage_gaps)} interval(s) have coverage gaps due to headcount constraints")

    return Schedule(assignments=assignments, coverage_gaps=coverage_gaps, warnings=warnings)

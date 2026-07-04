"""Convert forecast demand into staffing requirements via Erlang engine."""

from __future__ import annotations

from datetime import datetime

import numpy as np

from core.erlang.engine import kpis_for_agents, required_agents
from core.models import (
    IntervalDemand,
    IntervalMethod,
    Profile,
    SizingResult,
    SizingRow,
)


def derive_interval_pattern(
    historical_rows: list[dict],
    forecast_points: list[dict],
    interval_minutes: int = 30,
) -> IntervalDemand:
    """Derive intraday pattern from history or fall back to flat distribution."""
    approximations: list[str] = []
    has_interval_history = False

    if historical_rows:
        timestamps = [r.get("timestamp") for r in historical_rows if r.get("timestamp")]
        if timestamps and len(timestamps) > 1:
            deltas = [(timestamps[i + 1] - timestamps[i]).total_seconds() for i in range(len(timestamps) - 1)]
            if deltas and min(deltas) <= interval_minutes * 60:
                has_interval_history = True

    intervals: list[dict] = []

    if has_interval_history:
        method = IntervalMethod.HISTORICAL
        total_by_slot: dict[int, float] = {}
        counts: dict[int, int] = {}
        for row in historical_rows:
            ts = row.get("timestamp")
            vol = float(row.get("volume", 0))
            if not isinstance(ts, datetime):
                continue
            slot = ts.hour * 60 + ts.minute
            total_by_slot[slot] = total_by_slot.get(slot, 0) + vol
            counts[slot] = counts.get(slot, 0) + 1
        pattern = {k: total_by_slot[k] / counts[k] for k in total_by_slot}
        total_pattern = sum(pattern.values()) or 1.0
        weights = {k: v / total_pattern for k, v in pattern.items()}

        for fp in forecast_points:
            ts = fp["timestamp"]
            daily_vol = fp["volume"]
            for slot, weight in weights.items():
                hour = slot // 60
                minute = slot % 60
                interval_ts = ts.replace(hour=hour, minute=minute, second=0, microsecond=0)
                intervals.append({"timestamp": interval_ts, "volume": daily_vol * weight})
    else:
        method = IntervalMethod.FLAT_EQUAL
        approximations.append(
            "Estimated intraday pattern — no historical interval data available; using flat equal distribution"
        )
        slots_per_day = max(1, (18 - 8) * 60 // interval_minutes)
        for fp in forecast_points:
            ts = fp["timestamp"]
            daily_vol = fp["volume"]
            per_slot = daily_vol / slots_per_day
            for i in range(slots_per_day):
                hour = 8 + (i * interval_minutes) // 60
                minute = (i * interval_minutes) % 60
                interval_ts = ts.replace(hour=hour, minute=minute, second=0, microsecond=0)
                intervals.append({"timestamp": interval_ts, "volume": per_slot})

    return IntervalDemand(intervals=intervals, interval_method=method, approximations=approximations)


def size_intervals(
    demand: IntervalDemand,
    profile: Profile,
    occupancy_floor: float | None = None,
) -> SizingResult:
    interval_seconds = profile.interval_minutes * 60
    rows: list[SizingRow] = []
    approximations = list(demand.approximations)

    for item in demand.intervals:
        volume = float(item.get("volume", 0))
        ts = item["timestamp"]
        overrides: list[str] = []

        agents, kpi = required_agents(
            volume=volume,
            interval_seconds=interval_seconds,
            aht_seconds=profile.aht_seconds,
            model=profile.erlang_model,
            sla_target_pct=profile.sla_target_pct,
            sla_time_seconds=profile.sla_time_seconds,
            patience_seconds=profile.patience_seconds,
        )

        shrinkage_factor = 1.0 - profile.shrinkage_pct / 100.0
        if shrinkage_factor > 0:
            agents = int(np.ceil(agents / shrinkage_factor)) if agents > 0 else 0

        if occupancy_floor is not None and kpi.occupancy_pct < occupancy_floor:
            overrides.append(f"Occupancy floor {occupancy_floor}% applied")
            min_agents = max(agents, int(np.ceil(kpi.traffic_erlangs / (occupancy_floor / 100.0))))
            agents = min_agents
            kpi = kpis_for_agents(
                agents, volume, interval_seconds, profile.aht_seconds,
                profile.erlang_model, profile.sla_time_seconds, profile.patience_seconds,
            )

        rows.append(
            SizingRow(
                timestamp=ts,
                volume=volume,
                agents_required=agents,
                sla_pct=kpi.sla_pct,
                asa_seconds=kpi.asa_seconds,
                abandonment_pct=kpi.abandonment_pct,
                erlang_model=profile.erlang_model,
                overrides=overrides,
            )
        )

    return SizingResult(rows=rows, profile=profile, approximations=approximations)

"""Single Erlang A/B/C engine — one implementation per model."""

from __future__ import annotations

import math
from dataclasses import dataclass

from core.models import ErlangModel


@dataclass(frozen=True)
class ErlangKPIs:
    agents: int
    traffic_erlangs: float
    sla_pct: float
    asa_seconds: float
    abandonment_pct: float
    occupancy_pct: float
    model: ErlangModel


def erlang_b(agents: int, traffic: float) -> float:
    """Blocking probability Erlang B."""
    if agents <= 0:
        return 1.0
    if traffic <= 0:
        return 0.0
    inv_b = 1.0
    for k in range(1, agents + 1):
        inv_b = 1.0 + (k / traffic) * inv_b
    return 1.0 / inv_b


def erlang_c(agents: int, traffic: float) -> float:
    """Probability of wait Erlang C."""
    if agents <= 0:
        return 1.0
    if traffic <= 0:
        return 0.0
    if agents <= traffic:
        return 1.0
    b = erlang_b(agents, traffic)
    denom = agents - traffic * (1.0 - b)
    if denom <= 0:
        return 1.0
    return (agents * b) / denom


def sla_erlang_c(
    agents: int,
    traffic: float,
    aht_seconds: float,
    sla_time_seconds: float,
) -> float:
    """Service level for Erlang C: % answered within SLA time."""
    if traffic <= 0 or agents <= 0:
        return 100.0
    if agents <= traffic:
        return 0.0
    c = erlang_c(agents, traffic)
    if aht_seconds <= 0:
        return 0.0
    exponent = -(agents - traffic) * (sla_time_seconds / aht_seconds)
    return max(0.0, min(100.0, (1.0 - c * math.exp(exponent)) * 100.0))


def asa_erlang_c(agents: int, traffic: float, aht_seconds: float) -> float:
    """Average speed of answer for Erlang C."""
    if traffic <= 0 or agents <= 0:
        return 0.0
    if agents <= traffic:
        return float("inf")
    c = erlang_c(agents, traffic)
    return (c * aht_seconds) / (agents - traffic)


def abandonment_erlang_a(
    agents: int,
    traffic: float,
    aht_seconds: float,
    patience_seconds: float,
) -> float:
    """Abandonment rate for Erlang A (exponential patience)."""
    if traffic <= 0 or patience_seconds <= 0:
        return 0.0
    if agents <= traffic:
        return 100.0
    c = erlang_c(agents, traffic)
    if aht_seconds <= 0:
        return 0.0
    factor = (agents - traffic) / aht_seconds
    if factor <= 0:
        return 0.0
    return max(0.0, min(100.0, c * (factor / (factor + 1.0 / patience_seconds)) * 100.0))


def sla_erlang_a(
    agents: int,
    traffic: float,
    aht_seconds: float,
    sla_time_seconds: float,
    patience_seconds: float,
) -> float:
    """Service level for Erlang A with abandonment."""
    if traffic <= 0:
        return 100.0
    abandon = abandonment_erlang_a(agents, traffic, aht_seconds, patience_seconds) / 100.0
    base_sla = sla_erlang_c(agents, traffic, aht_seconds, sla_time_seconds) / 100.0
    return max(0.0, min(100.0, base_sla * (1.0 - abandon * 0.5) * 100.0))


def occupancy(traffic: float, agents: int) -> float:
    if agents <= 0:
        return 100.0
    return max(0.0, min(100.0, (traffic / agents) * 100.0))


def kpis_for_agents(
    agents: int,
    volume: float,
    interval_seconds: float,
    aht_seconds: float,
    model: ErlangModel,
    sla_time_seconds: float = 20.0,
    patience_seconds: float = 120.0,
) -> ErlangKPIs:
    """Compute KPIs for a fixed agent count using the selected model."""
    if interval_seconds <= 0:
        interval_seconds = 1800.0
    traffic = (volume * aht_seconds) / interval_seconds if volume > 0 else 0.0
    agents = max(1, agents)

    if model == ErlangModel.B:
        block = erlang_b(agents, traffic) * 100.0
        return ErlangKPIs(
            agents=agents,
            traffic_erlangs=traffic,
            sla_pct=max(0.0, 100.0 - block),
            asa_seconds=0.0,
            abandonment_pct=block,
            occupancy_pct=occupancy(traffic, agents),
            model=model,
        )

    if model == ErlangModel.C:
        return ErlangKPIs(
            agents=agents,
            traffic_erlangs=traffic,
            sla_pct=sla_erlang_c(agents, traffic, aht_seconds, sla_time_seconds),
            asa_seconds=asa_erlang_c(agents, traffic, aht_seconds),
            abandonment_pct=0.0,
            occupancy_pct=occupancy(traffic, agents),
            model=model,
        )

    # Erlang A
    return ErlangKPIs(
        agents=agents,
        traffic_erlangs=traffic,
        sla_pct=sla_erlang_a(agents, traffic, aht_seconds, sla_time_seconds, patience_seconds),
        asa_seconds=asa_erlang_c(agents, traffic, aht_seconds),
        abandonment_pct=abandonment_erlang_a(agents, traffic, aht_seconds, patience_seconds),
        occupancy_pct=occupancy(traffic, agents),
        model=model,
    )


def required_agents(
    volume: float,
    interval_seconds: float,
    aht_seconds: float,
    model: ErlangModel,
    sla_target_pct: float = 80.0,
    sla_time_seconds: float = 20.0,
    patience_seconds: float = 120.0,
    max_agents: int = 500,
) -> tuple[int, ErlangKPIs]:
    """Find minimum agents to meet SLA target."""
    if volume <= 0:
        kpi = kpis_for_agents(0, 0, interval_seconds, aht_seconds, model, sla_time_seconds, patience_seconds)
        return 0, kpi

    traffic = (volume * aht_seconds) / interval_seconds
    start = max(1, int(math.ceil(traffic)))

    for n in range(start, max_agents + 1):
        kpi = kpis_for_agents(n, volume, interval_seconds, aht_seconds, model, sla_time_seconds, patience_seconds)
        if model == ErlangModel.B:
            if kpi.abandonment_pct <= (100.0 - sla_target_pct):
                return n, kpi
        elif kpi.sla_pct >= sla_target_pct:
            return n, kpi

    kpi = kpis_for_agents(max_agents, volume, interval_seconds, aht_seconds, model, sla_time_seconds, patience_seconds)
    return max_agents, kpi

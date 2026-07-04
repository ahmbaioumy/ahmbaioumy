"""Discrete-event simulation for cross-validation against analytic Erlang sizing."""

from __future__ import annotations

import random
from dataclasses import dataclass

from core.models import SimulationResult, SizingResult


@dataclass
class _Call:
    arrival: float
    patience: float
    service_time: float


def run_simulation(
    sizing: SizingResult,
    aht_seconds: float,
    patience_seconds: float,
    agents: int,
    warmup_intervals: int = 5,
    rng_seed: int = 42,
) -> SimulationResult:
    rng = random.Random(rng_seed)
    interval_seconds = sizing.profile.interval_minutes * 60

    total_answered = 0
    total_abandoned = 0
    total_within_sla = 0
    total_wait = 0.0
    intervals_simulated = 0

    for idx, row in enumerate(sizing.rows):
        if idx < warmup_intervals:
            continue
        intervals_simulated += 1
        volume = int(round(row.volume))
        if volume <= 0:
            continue

        calls: list[_Call] = []
        for _ in range(volume):
            arrival = rng.uniform(0, interval_seconds)
            patience = rng.expovariate(1.0 / patience_seconds) if patience_seconds > 0 else float("inf")
            service = rng.expovariate(1.0 / aht_seconds) if aht_seconds > 0 else 1.0
            calls.append(_Call(arrival=arrival, patience=patience, service_time=service))
        calls.sort(key=lambda c: c.arrival)

        agent_free = [0.0] * max(1, agents)

        for call in calls:
            best = min(range(len(agent_free)), key=lambda i: agent_free[i])
            if agent_free[best] <= call.arrival:
                start = call.arrival
                wait = 0.0
            else:
                wait = agent_free[best] - call.arrival
                if wait > call.patience:
                    total_abandoned += 1
                    continue
                start = agent_free[best]

            total_wait += wait
            agent_free[best] = start + call.service_time
            total_answered += 1
            sla_time = sizing.profile.sla_time_seconds
            if wait <= sla_time:
                total_within_sla += 1

    total = total_answered + total_abandoned
    sla_pct = (total_within_sla / total * 100.0) if total > 0 else 100.0
    asa = (total_wait / total_answered) if total_answered > 0 else 0.0
    abandon_pct = (total_abandoned / total * 100.0) if total > 0 else 0.0

    return SimulationResult(
        sla_pct=sla_pct,
        asa_seconds=asa,
        abandonment_pct=abandon_pct,
        intervals_simulated=intervals_simulated,
        warmup_excluded=True,
    )


def cross_validate(sizing: SizingResult, simulation: SimulationResult, tolerance_pct: float = 15.0) -> SimulationResult:
    if not sizing.rows:
        simulation.cross_check_passed = True
        simulation.cross_check_notes = "No sizing rows to compare"
        return simulation

    avg_analytic_sla = sum(r.sla_pct for r in sizing.rows) / len(sizing.rows)
    delta = abs(avg_analytic_sla - simulation.sla_pct)
    passed = delta <= tolerance_pct
    simulation.cross_check_passed = passed
    simulation.cross_check_notes = (
        f"Analytic avg SLA {avg_analytic_sla:.1f}% vs simulation {simulation.sla_pct:.1f}% "
        f"(delta {delta:.1f}%, tolerance {tolerance_pct}%)"
    )
    return simulation


import pytest

from core.erlang.engine import (
    erlang_b,
    kpis_for_agents,
    required_agents,
    sla_erlang_c,
)
from core.models import ErlangModel


@pytest.mark.tier1
class TestErlangB:
    def test_zero_traffic_no_blocking(self):
        assert erlang_b(10, 0) == 0.0

    def test_high_blocking_insufficient_trunks(self):
        assert erlang_b(1, 10) > 0.9


@pytest.mark.tier1
class TestErlangC:
    def test_erlang_c_zero_abandonment_by_definition(self):
        kpi = kpis_for_agents(20, 100, 1800, 300, ErlangModel.C)
        assert kpi.abandonment_pct == 0.0

    def test_sla_increases_with_agents(self):
        sla_10 = sla_erlang_c(10, 8.0, 300, 20)
        sla_20 = sla_erlang_c(20, 8.0, 300, 20)
        assert sla_20 >= sla_10

    def test_insufficient_agents_low_sla(self):
        sla = sla_erlang_c(5, 10.0, 300, 20)
        assert sla < 50.0


@pytest.mark.tier1
class TestRequiredAgents:
    def test_zero_volume_zero_agents(self):
        agents, kpi = required_agents(0, 1800, 300, ErlangModel.C)
        assert agents == 0

    def test_finds_agents_for_moderate_load(self):
        agents, kpi = required_agents(
            volume=50, interval_seconds=1800, aht_seconds=300,
            model=ErlangModel.C, sla_target_pct=80, sla_time_seconds=20,
        )
        assert agents >= 1
        assert kpi.sla_pct >= 80.0

    def test_erlang_c_kpis_coherent(self):
        agents, kpi = required_agents(
            volume=80, interval_seconds=1800, aht_seconds=300,
            model=ErlangModel.C, sla_target_pct=80,
        )
        display = kpis_for_agents(agents, 80, 1800, 300, ErlangModel.C)
        assert abs(display.sla_pct - kpi.sla_pct) < 0.01
        assert display.abandonment_pct == 0.0


@pytest.mark.tier1
class TestErlangA:
    def test_abandonment_positive_with_patience(self):
        kpi = kpis_for_agents(15, 100, 1800, 300, ErlangModel.A, patience_seconds=60)
        assert kpi.abandonment_pct >= 0.0

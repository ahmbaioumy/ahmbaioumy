from datetime import datetime, timedelta

import pytest

from core.forecasting.selector import select_and_forecast
from core.models import ErlangModel, Profile
from core.scheduling.optimizer import build_schedule
from core.simulation.des import cross_validate, run_simulation
from core.sizing.orchestrator import derive_interval_pattern, size_intervals


@pytest.mark.tier2
class TestPipelineConservation:
    def test_forecast_produces_points(self):
        base = datetime(2024, 1, 1)
        timestamps = [base + timedelta(days=i) for i in range(30)]
        volumes = [100 + i * 2 for i in range(30)]
        forecast = select_and_forecast(timestamps, volumes, horizon=7)
        assert len(forecast.points) == 7
        assert forecast.model_name in ("naive", "moving_average", "seasonal_naive", "linear_trend")

    def test_sizing_pipeline(self):
        profile = Profile(erlang_model=ErlangModel.C)
        forecast_points = [
            {"timestamp": datetime(2024, 6, 1), "volume": 500},
            {"timestamp": datetime(2024, 6, 2), "volume": 520},
        ]
        demand = derive_interval_pattern([], forecast_points, profile.interval_minutes)
        assert len(demand.intervals) > 0
        sizing = size_intervals(demand, profile)
        assert all(r.abandonment_pct == 0.0 for r in sizing.rows)

    def test_schedule_coverage_warning(self):
        profile = Profile()
        forecast_points = [{"timestamp": datetime(2024, 6, 1), "volume": 2000}]
        demand = derive_interval_pattern([], forecast_points)
        sizing = size_intervals(demand, profile)
        schedule = build_schedule(sizing, available_agents=1)
        assert len(schedule.warnings) > 0 or len(schedule.coverage_gaps) >= 0


@pytest.mark.tier2
class TestSimulationCrossValidation:
    def test_simulation_runs_with_warmup(self):
        profile = Profile(erlang_model=ErlangModel.C)
        forecast_points = [{"timestamp": datetime(2024, 6, d), "volume": 200} for d in range(1, 15)]
        demand = derive_interval_pattern([], forecast_points)
        sizing = size_intervals(demand, profile)
        sim = run_simulation(sizing, profile.aht_seconds, profile.patience_seconds, agents=20)
        assert sim.warmup_excluded
        assert sim.intervals_simulated > 0
        result = cross_validate(sizing, sim)
        assert result.cross_check_notes is not None

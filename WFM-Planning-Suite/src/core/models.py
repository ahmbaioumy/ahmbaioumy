"""Domain models for the WFM planning pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class ChannelType(str, Enum):
    VOICE = "voice"
    CHAT = "chat"
    EMAIL = "email"


class ErlangModel(str, Enum):
    A = "erlang_a"
    B = "erlang_b"
    C = "erlang_c"


class IntervalMethod(str, Enum):
    HISTORICAL = "historical"
    FLAT_EQUAL = "flat_equal"


@dataclass
class Profile:
    name: str = "Default"
    sla_target_pct: float = 80.0
    sla_time_seconds: float = 20.0
    aht_seconds: float = 300.0
    shrinkage_pct: float = 30.0
    occupancy_target_pct: float = 85.0
    patience_seconds: float = 120.0
    operating_hours_start: int = 8
    operating_hours_end: int = 18
    channel: ChannelType = ChannelType.VOICE
    erlang_model: ErlangModel = ErlangModel.C
    interval_minutes: int = 30

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "sla_target_pct": self.sla_target_pct,
            "sla_time_seconds": self.sla_time_seconds,
            "aht_seconds": self.aht_seconds,
            "shrinkage_pct": self.shrinkage_pct,
            "occupancy_target_pct": self.occupancy_target_pct,
            "patience_seconds": self.patience_seconds,
            "operating_hours_start": self.operating_hours_start,
            "operating_hours_end": self.operating_hours_end,
            "channel": self.channel.value,
            "erlang_model": self.erlang_model.value,
            "interval_minutes": self.interval_minutes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Profile:
        return cls(
            name=data.get("name", "Default"),
            sla_target_pct=float(data.get("sla_target_pct", 80.0)),
            sla_time_seconds=float(data.get("sla_time_seconds", 20.0)),
            aht_seconds=float(data.get("aht_seconds", 300.0)),
            shrinkage_pct=float(data.get("shrinkage_pct", 30.0)),
            occupancy_target_pct=float(data.get("occupancy_target_pct", 85.0)),
            patience_seconds=float(data.get("patience_seconds", 120.0)),
            operating_hours_start=int(data.get("operating_hours_start", 8)),
            operating_hours_end=int(data.get("operating_hours_end", 18)),
            channel=ChannelType(data.get("channel", "voice")),
            erlang_model=ErlangModel(data.get("erlang_model", "erlang_c")),
            interval_minutes=int(data.get("interval_minutes", 30)),
        )


@dataclass
class ValidationIssue:
    severity: str
    code: str
    message: str
    row_index: int | None = None


@dataclass
class RawUpload:
    rows: list[dict[str, Any]]
    date_format: str
    granularity_minutes: int
    column_mapping: dict[str, str]
    issues: list[ValidationIssue] = field(default_factory=list)
    date_range: tuple[datetime, datetime] | None = None


@dataclass
class CleansedSeries:
    rows: list[dict[str, Any]]
    method_applied: str
    changes: list[dict[str, Any]] = field(default_factory=list)
    approximations: list[str] = field(default_factory=list)


@dataclass
class ForecastPoint:
    timestamp: datetime
    volume: float
    lower: float | None = None
    upper: float | None = None


@dataclass
class Forecast:
    points: list[ForecastPoint]
    model_name: str
    accuracy_wmape: float | None
    accuracy_mape: float | None
    bias: float | None
    fallback_used: bool = False
    fallback_reason: str | None = None


@dataclass
class IntervalDemand:
    intervals: list[dict[str, Any]]
    interval_method: IntervalMethod
    approximations: list[str] = field(default_factory=list)


@dataclass
class SizingRow:
    timestamp: datetime
    volume: float
    agents_required: int
    sla_pct: float
    asa_seconds: float
    abandonment_pct: float
    erlang_model: ErlangModel
    overrides: list[str] = field(default_factory=list)


@dataclass
class SizingResult:
    rows: list[SizingRow]
    profile: Profile
    approximations: list[str] = field(default_factory=list)


@dataclass
class ScheduleAssignment:
    agent_id: str
    shift_start: datetime
    shift_end: datetime


@dataclass
class Schedule:
    assignments: list[ScheduleAssignment]
    coverage_gaps: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class SimulationResult:
    sla_pct: float
    asa_seconds: float
    abandonment_pct: float
    intervals_simulated: int
    warmup_excluded: bool = True
    cross_check_passed: bool | None = None
    cross_check_notes: str | None = None


@dataclass
class Report:
    title: str
    generated_at: datetime
    sections: list[dict[str, Any]]
    traceability: dict[str, dict[str, Any]]

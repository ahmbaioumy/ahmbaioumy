from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfo(BaseModel):
    username: str
    role: str = "agent"


class LoginRequest(BaseModel):
    username: str
    password: str


class PredictRequest(BaseModel):
    transcript: str
    nps_history: Optional[List[int]] = None


class PredictResponse(BaseModel):
    label: str
    prob_detractor: float
    sentiment: float
    explanation: str


class ChatMessageIn(BaseModel):
    sender: str = Field(pattern="^(agent|customer|system)$")
    content: str


class ChatMessageOut(BaseModel):
    id: int
    session_id: str
    sender: str
    content: str
    timestamp: datetime
    sentiment_score: float | None = None
    detractor_risk: float | None = None


class ManagerSummary(BaseModel):
    totals: dict
    by_day: list
    recent_chats: list


PrayerName = Literal["fajr", "dhuhr", "asr", "maghrib", "isha"]
PrayerMode = Literal["auto", "manual"]
PrayerCalcMethod = Literal["MWL", "ISNA", "Egypt", "Makkah", "Karachi"]
Madhab = Literal["shafi", "hanafi"]

IbadahType = Literal["azkar_am", "azkar_pm", "quran_page", "dua_10m", "sadaqa", "night_prayer"]


class PrayerSettingsUpsert(BaseModel):
    mode: PrayerMode = "auto"
    latitude: float | None = None
    longitude: float | None = None
    tz_offset_min: int = 0
    calc_method: PrayerCalcMethod = "MWL"
    madhab: Madhab = "shafi"
    reminder_interval_min: int = 15
    critical_before_next_min: int = 10
    allow_late_mark: bool = True


class PrayerSettingsOut(PrayerSettingsUpsert):
    username: str
    updated_at: datetime | None = None


class ManualPrayerTimes(BaseModel):
    fajr_local: str
    dhuhr_local: str
    asr_local: str
    maghrib_local: str
    isha_local: str


class PrayerDayScheduleOut(BaseModel):
    day: str
    source: PrayerMode
    fajr_at: datetime
    dhuhr_at: datetime
    asr_at: datetime
    maghrib_at: datetime
    isha_at: datetime


class PrayerLogOut(BaseModel):
    prayer: PrayerName
    scheduled_at: datetime
    next_prayer_at: datetime | None = None
    status: Literal["pending", "completed", "missed"]
    bucket: str | None = None
    points: int
    marked_at: datetime | None = None


class PrayerTodayOut(BaseModel):
    schedule: PrayerDayScheduleOut
    logs: List[PrayerLogOut]
    points_today: int
    rating_today: float


class PrayerMarkRequest(BaseModel):
    status: Literal["completed", "missed"]
    marked_at_utc: datetime | None = None
    note: str | None = None


class IbadahSettingsUpsert(BaseModel):
    enabled_types: List[IbadahType]


class IbadahSettingsOut(IbadahSettingsUpsert):
    username: str
    updated_at: datetime | None = None


class IbadahLogOut(BaseModel):
    ibadah_type: IbadahType
    status: Literal["pending", "completed", "skipped"]
    points: int
    duration_min: int | None = None
    marked_at: datetime | None = None


class IbadahMarkRequest(BaseModel):
    status: Literal["completed", "skipped"]
    duration_min: int | None = None
    marked_at_utc: datetime | None = None


class PrayerStatsOut(BaseModel):
    points_mtd: int
    days: List[dict]


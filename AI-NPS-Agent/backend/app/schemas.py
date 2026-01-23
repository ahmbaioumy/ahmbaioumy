from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


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


class PrayerManualTimes(BaseModel):
    fajr: str
    dhuhr: str
    asr: str
    maghrib: str
    isha: str


class PrayerSettingsUpdate(BaseModel):
    method: str | None = Field(default=None, pattern="^(auto|manual)$")
    latitude: float | None = None
    longitude: float | None = None
    timezone_offset_minutes: int | None = None
    reminder_interval_minutes: int | None = None
    critical_before_next_minutes: int | None = None
    asr_shadow_factor: int | None = None
    fajr_angle: float | None = None
    isha_angle: float | None = None
    manual_times: PrayerManualTimes | None = None


class PrayerSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    method: str
    latitude: float | None = None
    longitude: float | None = None
    timezone_offset_minutes: int
    reminder_interval_minutes: int
    critical_before_next_minutes: int
    asr_shadow_factor: int
    fajr_angle: float
    isha_angle: float
    manual_times: PrayerManualTimes | None = None


class PrayerEntryOut(BaseModel):
    prayer_name: str
    scheduled_at: datetime
    completed_at: datetime | None = None
    status: str
    bucket: str | None = None


class PrayerScheduleResponse(BaseModel):
    date: str
    timezone_offset_minutes: int
    schedule: List[PrayerEntryOut]


class PrayerMarkRequest(BaseModel):
    date: str
    prayer_name: str
    completed_at: datetime | None = None
    status: str | None = None
    bucket_override: str | None = None


class DevotionOption(BaseModel):
    key: str
    label: str


class DevotionStatus(BaseModel):
    key: str
    label: str
    completed: bool
    completed_at: datetime | None = None


class DevotionMarkRequest(BaseModel):
    date: str
    key: str
    completed: bool


class PrayerSummaryResponse(BaseModel):
    date: str
    daily_score: float
    mtd_score: float
    counts: dict
    weekly: list
    monthly: list


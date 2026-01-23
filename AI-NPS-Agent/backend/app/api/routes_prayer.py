from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import PrayerSettings, PrayerEntry, DevotionEntry
from app.schemas import (
    PrayerManualTimes,
    PrayerSettingsOut,
    PrayerSettingsUpdate,
    PrayerScheduleResponse,
    PrayerEntryOut,
    PrayerMarkRequest,
    DevotionStatus,
    DevotionMarkRequest,
    PrayerSummaryResponse,
)
from app.services.prayer_times import PrayerTimeConfig, calculate_prayer_times, PRAYER_ORDER
from app.utils.auth import get_current_user

router = APIRouter()

DEVOTION_OPTIONS = [
    {"key": "azkar_morning_evening", "label": "Morning/Evening Azkar"},
    {"key": "quran_page", "label": "Finish 1 Quran page"},
    {"key": "dua_10_min", "label": "Dua for 10 minutes"},
    {"key": "sadaqa_ramadan", "label": "Sadaqa in Ramadan"},
    {"key": "taraweeh", "label": "Taraweeh prayer"},
    {"key": "tahajjud_quran", "label": "Tahajjud with Quran"},
]


def _local_now(offset_minutes: int) -> datetime:
    return datetime.utcnow() + timedelta(minutes=offset_minutes)


def _parse_date(date_str: str | None, offset_minutes: int) -> date:
    if date_str:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    return _local_now(offset_minutes).date()


def _parse_time(value: str) -> time:
    try:
        return time.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {value}") from exc


def _manual_times(settings: PrayerSettings) -> PrayerManualTimes | None:
    if not all(
        [
            settings.manual_fajr,
            settings.manual_dhuhr,
            settings.manual_asr,
            settings.manual_maghrib,
            settings.manual_isha,
        ]
    ):
        return None
    return PrayerManualTimes(
        fajr=settings.manual_fajr,
        dhuhr=settings.manual_dhuhr,
        asr=settings.manual_asr,
        maghrib=settings.manual_maghrib,
        isha=settings.manual_isha,
    )


def _settings_to_schema(settings: PrayerSettings) -> PrayerSettingsOut:
    return PrayerSettingsOut(
        method=settings.method,
        latitude=settings.latitude,
        longitude=settings.longitude,
        timezone_offset_minutes=settings.timezone_offset_minutes or 0,
        reminder_interval_minutes=settings.reminder_interval_minutes or 10,
        critical_before_next_minutes=settings.critical_before_next_minutes or 15,
        asr_shadow_factor=settings.asr_shadow_factor or 1,
        fajr_angle=settings.fajr_angle or 18.0,
        isha_angle=settings.isha_angle or 17.0,
        manual_times=_manual_times(settings),
    )


async def _get_or_create_settings(db: AsyncSession, user_id: str) -> PrayerSettings:
    res = await db.execute(select(PrayerSettings).where(PrayerSettings.user_id == user_id))
    settings = res.scalar_one_or_none()
    if settings:
        return settings
    settings = PrayerSettings(
        user_id=user_id,
        method="auto",
        timezone_offset_minutes=0,
        reminder_interval_minutes=10,
        critical_before_next_minutes=15,
        asr_shadow_factor=1,
        fajr_angle=18.0,
        isha_angle=17.0,
    )
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


def _calculate_schedule(day: date, settings: PrayerSettings) -> Dict[str, datetime]:
    if settings.method == "manual":
        manual = _manual_times(settings)
        if manual is None:
            raise HTTPException(status_code=400, detail="Manual times are required for manual method")
        return {
            "fajr": datetime.combine(day, _parse_time(manual.fajr)),
            "dhuhr": datetime.combine(day, _parse_time(manual.dhuhr)),
            "asr": datetime.combine(day, _parse_time(manual.asr)),
            "maghrib": datetime.combine(day, _parse_time(manual.maghrib)),
            "isha": datetime.combine(day, _parse_time(manual.isha)),
        }

    if settings.latitude is None or settings.longitude is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude required for auto method")

    config = PrayerTimeConfig(
        fajr_angle=settings.fajr_angle or 18.0,
        isha_angle=settings.isha_angle or 17.0,
        asr_shadow_factor=settings.asr_shadow_factor or 1,
        timezone_offset_minutes=settings.timezone_offset_minutes or 0,
    )
    calculated = calculate_prayer_times(day, settings.latitude, settings.longitude, config)
    return {name: calculated[name] for name in PRAYER_ORDER}


async def _upsert_schedule(
    db: AsyncSession,
    user_id: str,
    date_str: str,
    schedule: Dict[str, datetime],
) -> List[PrayerEntry]:
    res = await db.execute(
        select(PrayerEntry).where(PrayerEntry.user_id == user_id, PrayerEntry.date == date_str)
    )
    existing_entries = {entry.prayer_name: entry for entry in res.scalars().all()}
    updated_entries: List[PrayerEntry] = []
    for prayer_name in PRAYER_ORDER:
        scheduled_at = schedule[prayer_name]
        entry = existing_entries.get(prayer_name)
        if entry is None:
            entry = PrayerEntry(
                user_id=user_id,
                date=date_str,
                prayer_name=prayer_name,
                scheduled_at=scheduled_at,
                status="pending",
            )
            db.add(entry)
        else:
            entry.scheduled_at = scheduled_at
        updated_entries.append(entry)
    await db.commit()
    for entry in updated_entries:
        await db.refresh(entry)
    return updated_entries


def _completion_bucket(
    completed_at: datetime,
    scheduled_at: datetime,
    next_prayer_time: datetime | None,
) -> str:
    if next_prayer_time and completed_at >= next_prayer_time:
        return "with_next"
    delta_minutes = (completed_at - scheduled_at).total_seconds() / 60.0
    if delta_minutes <= 60:
        return "first_hour"
    if delta_minutes <= 120:
        return "second_hour"
    if delta_minutes <= 180:
        return "third_hour"
    return "after_time"


def _score_for_bucket(status: str, bucket: str | None) -> float:
    if status != "completed":
        return 0.0
    weights = {
        "first_hour": 1.0,
        "second_hour": 0.8,
        "third_hour": 0.6,
        "after_time": 0.4,
        "with_next": 0.3,
    }
    return weights.get(bucket or "", 0.2)


@router.get("/settings", response_model=PrayerSettingsOut)
async def get_settings(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> PrayerSettingsOut:
    settings = await _get_or_create_settings(db, user["username"])
    return _settings_to_schema(settings)


@router.put("/settings", response_model=PrayerSettingsOut)
async def update_settings(
    payload: PrayerSettingsUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrayerSettingsOut:
    settings = await _get_or_create_settings(db, user["username"])
    data = payload.model_dump(exclude_unset=True)

    for field in [
        "method",
        "latitude",
        "longitude",
        "timezone_offset_minutes",
        "reminder_interval_minutes",
        "critical_before_next_minutes",
        "asr_shadow_factor",
        "fajr_angle",
        "isha_angle",
    ]:
        if field in data:
            setattr(settings, field, data[field])

    manual = payload.manual_times
    if manual is not None:
        settings.manual_fajr = manual.fajr
        settings.manual_dhuhr = manual.dhuhr
        settings.manual_asr = manual.asr
        settings.manual_maghrib = manual.maghrib
        settings.manual_isha = manual.isha

    await db.commit()
    await db.refresh(settings)
    return _settings_to_schema(settings)


@router.get("/schedule", response_model=PrayerScheduleResponse)
async def get_schedule(
    date_str: str | None = Query(default=None, alias="date"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrayerScheduleResponse:
    settings = await _get_or_create_settings(db, user["username"])
    offset = settings.timezone_offset_minutes or 0
    day = _parse_date(date_str, offset)
    schedule = _calculate_schedule(day, settings)
    entries = await _upsert_schedule(db, user["username"], day.isoformat(), schedule)
    return PrayerScheduleResponse(
        date=day.isoformat(),
        timezone_offset_minutes=offset,
        schedule=[
            PrayerEntryOut(
                prayer_name=entry.prayer_name,
                scheduled_at=entry.scheduled_at,
                completed_at=entry.completed_at,
                status=entry.status,
                bucket=entry.bucket,
            )
            for entry in sorted(entries, key=lambda e: PRAYER_ORDER.index(e.prayer_name))
        ],
    )


@router.post("/mark", response_model=PrayerEntryOut)
async def mark_prayer(
    payload: PrayerMarkRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrayerEntryOut:
    settings = await _get_or_create_settings(db, user["username"])
    offset = settings.timezone_offset_minutes or 0
    day = _parse_date(payload.date, offset)
    schedule = _calculate_schedule(day, settings)
    entries = await _upsert_schedule(db, user["username"], day.isoformat(), schedule)
    entry_map = {entry.prayer_name: entry for entry in entries}

    entry = entry_map.get(payload.prayer_name)
    if entry is None:
        raise HTTPException(status_code=404, detail="Prayer not found")

    if payload.status == "missed":
        entry.status = "missed"
        entry.bucket = "missed"
        entry.completed_at = payload.completed_at
        await db.commit()
        await db.refresh(entry)
        return PrayerEntryOut(
            prayer_name=entry.prayer_name,
            scheduled_at=entry.scheduled_at,
            completed_at=entry.completed_at,
            status=entry.status,
            bucket=entry.bucket,
        )

    completed_at = payload.completed_at or _local_now(offset)
    prayer_index = PRAYER_ORDER.index(entry.prayer_name)
    next_prayer_time = None
    if prayer_index < len(PRAYER_ORDER) - 1:
        next_prayer_time = schedule[PRAYER_ORDER[prayer_index + 1]]
    else:
        next_day = day + timedelta(days=1)
        next_schedule = _calculate_schedule(next_day, settings)
        next_prayer_time = next_schedule["fajr"]

    bucket = payload.bucket_override or _completion_bucket(completed_at, entry.scheduled_at, next_prayer_time)
    entry.status = "completed"
    entry.bucket = bucket
    entry.completed_at = completed_at
    await db.commit()
    await db.refresh(entry)
    return PrayerEntryOut(
        prayer_name=entry.prayer_name,
        scheduled_at=entry.scheduled_at,
        completed_at=entry.completed_at,
        status=entry.status,
        bucket=entry.bucket,
    )


@router.get("/devotions", response_model=List[DevotionStatus])
async def get_devotions(
    date_str: str | None = Query(default=None, alias="date"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DevotionStatus]:
    settings = await _get_or_create_settings(db, user["username"])
    day = _parse_date(date_str, settings.timezone_offset_minutes or 0)
    res = await db.execute(
        select(DevotionEntry).where(DevotionEntry.user_id == user["username"], DevotionEntry.date == day.isoformat())
    )
    entries = {entry.devotion_key: entry for entry in res.scalars().all()}
    response: List[DevotionStatus] = []
    for option in DEVOTION_OPTIONS:
        entry = entries.get(option["key"])
        response.append(
            DevotionStatus(
                key=option["key"],
                label=option["label"],
                completed=bool(entry.completed) if entry else False,
                completed_at=entry.completed_at if entry else None,
            )
        )
    return response


@router.post("/devotions/mark", response_model=DevotionStatus)
async def mark_devotion(
    payload: DevotionMarkRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DevotionStatus:
    settings = await _get_or_create_settings(db, user["username"])
    day = _parse_date(payload.date, settings.timezone_offset_minutes or 0)
    res = await db.execute(
        select(DevotionEntry).where(
            DevotionEntry.user_id == user["username"],
            DevotionEntry.date == day.isoformat(),
            DevotionEntry.devotion_key == payload.key,
        )
    )
    entry = res.scalar_one_or_none()
    if entry is None:
        entry = DevotionEntry(
            user_id=user["username"],
            date=day.isoformat(),
            devotion_key=payload.key,
        )
        db.add(entry)
    entry.completed = payload.completed
    entry.completed_at = _local_now(settings.timezone_offset_minutes or 0) if payload.completed else None
    await db.commit()
    await db.refresh(entry)

    label = next((item["label"] for item in DEVOTION_OPTIONS if item["key"] == payload.key), payload.key)
    return DevotionStatus(
        key=payload.key,
        label=label,
        completed=bool(entry.completed),
        completed_at=entry.completed_at,
    )


@router.get("/summary", response_model=PrayerSummaryResponse)
async def prayer_summary(
    date_str: str | None = Query(default=None, alias="date"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrayerSummaryResponse:
    settings = await _get_or_create_settings(db, user["username"])
    offset = settings.timezone_offset_minutes or 0
    day = _parse_date(date_str, offset)
    today_str = day.isoformat()

    month_start = day.replace(day=1)
    range_start = day - timedelta(days=29)
    res = await db.execute(
        select(PrayerEntry).where(
            PrayerEntry.user_id == user["username"],
            PrayerEntry.date >= range_start.isoformat(),
            PrayerEntry.date <= today_str,
        )
    )
    entries = res.scalars().all()
    by_date: Dict[str, List[PrayerEntry]] = {}
    for entry in entries:
        by_date.setdefault(entry.date, []).append(entry)

    def daily_score(date_key: str) -> float:
        daily_entries = by_date.get(date_key, [])
        score = 0.0
        for entry in daily_entries:
            status = entry.status
            bucket = entry.bucket
            if status == "pending" and entry.date < today_str:
                status = "missed"
                bucket = "missed"
            score += _score_for_bucket(status, bucket)
        return round((score / 5.0) * 100.0, 2) if daily_entries else 0.0

    counts = {
        "completed": 0,
        "missed": 0,
        "pending": 0,
        "first_hour": 0,
        "second_hour": 0,
        "third_hour": 0,
        "after_time": 0,
        "with_next": 0,
    }
    for entry in by_date.get(today_str, []):
        status = entry.status
        bucket = entry.bucket or ""
        if status == "pending":
            counts["pending"] += 1
        elif status == "missed":
            counts["missed"] += 1
        else:
            counts["completed"] += 1
            if bucket in counts:
                counts[bucket] += 1

    weekly = []
    for i in range(6, -1, -1):
        day_key = (day - timedelta(days=i)).isoformat()
        weekly.append({"date": day_key, "score": daily_score(day_key)})

    monthly = []
    for i in range(29, -1, -1):
        day_key = (day - timedelta(days=i)).isoformat()
        monthly.append({"date": day_key, "score": daily_score(day_key)})

    mtd_scores = []
    current = month_start
    while current <= day:
        mtd_scores.append(daily_score(current.isoformat()))
        current += timedelta(days=1)
    mtd_score = round(sum(mtd_scores) / len(mtd_scores), 2) if mtd_scores else 0.0

    return PrayerSummaryResponse(
        date=today_str,
        daily_score=daily_score(today_str),
        mtd_score=mtd_score,
        counts=counts,
        weekly=weekly,
        monthly=monthly,
    )

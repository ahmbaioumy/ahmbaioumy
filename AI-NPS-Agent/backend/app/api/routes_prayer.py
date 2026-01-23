from __future__ import annotations

import json
from datetime import datetime, date, timedelta, time
from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import PrayerSettings, PrayerDaySchedule, PrayerLog, IbadahSettings, IbadahLog
from app.schemas import (
    PrayerSettingsUpsert,
    PrayerSettingsOut,
    PrayerTodayOut,
    PrayerDayScheduleOut,
    PrayerLogOut,
    PrayerMarkRequest,
    ManualPrayerTimes,
    IbadahSettingsUpsert,
    IbadahSettingsOut,
    IbadahLogOut,
    IbadahMarkRequest,
    PrayerStatsOut,
)
from app.utils.auth import get_current_user
from app.services.prayer_times import compute_prayer_times_local_hours


router = APIRouter()

PRAYERS: list[str] = ["fajr", "dhuhr", "asr", "maghrib", "isha"]
IBADAH_TYPES: list[str] = ["azkar_am", "azkar_pm", "quran_page", "dua_10m", "sadaqa", "night_prayer"]


def _parse_day(day_str: str) -> date:
    try:
        return date.fromisoformat(day_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid day: {day_str}") from e


def _ensure_defaults(settings: PrayerSettings | None, username: str) -> PrayerSettings:
    if settings is not None:
        return settings
    return PrayerSettings(username=username)


def _local_hours_from_hhmm(s: str) -> float:
    try:
        hh, mm = s.strip().split(":")
        h = int(hh)
        m = int(mm)
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("range")
        return h + m / 60.0
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid time: {s}") from e


def _utc_from_local_hours(*, day: date, local_hours: float, tz_offset_min: int) -> datetime:
    base = datetime.combine(day, time(0, 0, 0))
    local_dt = base + timedelta(hours=local_hours)
    return local_dt + timedelta(minutes=tz_offset_min)


def _normalize_monotonic(hours_by_name: dict[str, float]) -> dict[str, float]:
    out: dict[str, float] = {}
    last = None
    for name in ["fajr", "dhuhr", "asr", "maghrib", "isha"]:
        h = float(hours_by_name[name])
        if last is not None:
            while h < last:
                h += 24.0
        out[name] = h
        last = h
    return out


async def _get_settings(db: AsyncSession, username: str) -> PrayerSettings:
    res = await db.execute(select(PrayerSettings).where(PrayerSettings.username == username))
    settings = res.scalars().first()
    if settings is None:
        settings = PrayerSettings(username=username)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def _get_ibadah_settings(db: AsyncSession, username: str) -> IbadahSettings:
    res = await db.execute(select(IbadahSettings).where(IbadahSettings.username == username))
    settings = res.scalars().first()
    if settings is None:
        settings = IbadahSettings(username=username)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def _get_or_compute_schedule(db: AsyncSession, *, username: str, day: date, settings: PrayerSettings) -> PrayerDaySchedule:
    res = await db.execute(
        select(PrayerDaySchedule).where(PrayerDaySchedule.username == username, PrayerDaySchedule.day == day)
    )
    schedule = res.scalars().first()
    if schedule is not None and schedule.source == "manual":
        return schedule

    if settings.mode != "auto":
        if schedule is None:
            raise HTTPException(status_code=400, detail="Manual mode requires manual schedule for the day")
        return schedule

    if settings.latitude is None or settings.longitude is None:
        raise HTTPException(status_code=400, detail="Missing location (latitude/longitude)")

    hours = compute_prayer_times_local_hours(
        d=day,
        latitude=float(settings.latitude),
        longitude=float(settings.longitude),
        tz_offset_min=int(settings.tz_offset_min),
        method=str(settings.calc_method),
        madhab=str(settings.madhab),
    )
    hours = _normalize_monotonic(hours)
    fajr_at = _utc_from_local_hours(day=day, local_hours=hours["fajr"], tz_offset_min=settings.tz_offset_min)
    dhuhr_at = _utc_from_local_hours(day=day, local_hours=hours["dhuhr"], tz_offset_min=settings.tz_offset_min)
    asr_at = _utc_from_local_hours(day=day, local_hours=hours["asr"], tz_offset_min=settings.tz_offset_min)
    maghrib_at = _utc_from_local_hours(day=day, local_hours=hours["maghrib"], tz_offset_min=settings.tz_offset_min)
    isha_at = _utc_from_local_hours(day=day, local_hours=hours["isha"], tz_offset_min=settings.tz_offset_min)

    if schedule is None:
        schedule = PrayerDaySchedule(
            username=username,
            day=day,
            source="auto",
            fajr_at=fajr_at,
            dhuhr_at=dhuhr_at,
            asr_at=asr_at,
            maghrib_at=maghrib_at,
            isha_at=isha_at,
        )
        db.add(schedule)
    else:
        schedule.source = "auto"
        schedule.fajr_at = fajr_at
        schedule.dhuhr_at = dhuhr_at
        schedule.asr_at = asr_at
        schedule.maghrib_at = maghrib_at
        schedule.isha_at = isha_at

    await db.commit()
    await db.refresh(schedule)
    return schedule


async def _ensure_prayer_logs(db: AsyncSession, *, username: str, day: date, schedule: PrayerDaySchedule) -> list[PrayerLog]:
    res = await db.execute(
        select(PrayerLog).where(PrayerLog.username == username, PrayerLog.day == day).order_by(PrayerLog.prayer)
    )
    existing = {pl.prayer: pl for pl in res.scalars().all()}

    times = {
        "fajr": schedule.fajr_at,
        "dhuhr": schedule.dhuhr_at,
        "asr": schedule.asr_at,
        "maghrib": schedule.maghrib_at,
        "isha": schedule.isha_at,
    }
    ordered = sorted(times.items(), key=lambda kv: kv[1])
    next_by_name: dict[str, datetime | None] = {}
    for i, (name, _) in enumerate(ordered):
        next_by_name[name] = ordered[i + 1][1] if i + 1 < len(ordered) else None

    changed = False
    for name in PRAYERS:
        sched_at = times[name]
        nxt = next_by_name[name]
        pl = existing.get(name)
        if pl is None:
            pl = PrayerLog(
                username=username,
                day=day,
                prayer=name,
                scheduled_at=sched_at,
                next_prayer_at=nxt,
            )
            db.add(pl)
            changed = True
        else:
            if pl.scheduled_at != sched_at or pl.next_prayer_at != nxt:
                pl.scheduled_at = sched_at
                pl.next_prayer_at = nxt
                changed = True

    if changed:
        await db.commit()

    res2 = await db.execute(
        select(PrayerLog).where(PrayerLog.username == username, PrayerLog.day == day).order_by(PrayerLog.scheduled_at)
    )
    return res2.scalars().all()


def _score_prayer(*, scheduled_at: datetime, next_prayer_at: datetime | None, marked_at: datetime, status: str) -> tuple[str | None, int]:
    if status == "missed":
        return "missed", 0

    delta = marked_at - scheduled_at
    minutes = delta.total_seconds() / 60.0
    if minutes <= 60:
        return "h1", 10
    if minutes <= 120:
        return "h2", 7
    if minutes <= 180:
        return "h3", 4
    if next_prayer_at is None:
        return "after3", 2
    if marked_at < next_prayer_at:
        return "after3", 2
    return "after_next", 1


def _rating(points: int, max_points: int) -> float:
    if max_points <= 0:
        return 0.0
    v = (points / max_points) * 5.0
    return max(0.0, min(5.0, round(v, 2)))


@router.get("/settings", response_model=PrayerSettingsOut)
async def get_prayer_settings(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> PrayerSettingsOut:
    settings = await _get_settings(db, user["username"])
    return PrayerSettingsOut(
        username=settings.username,
        mode=settings.mode,
        latitude=settings.latitude,
        longitude=settings.longitude,
        tz_offset_min=settings.tz_offset_min,
        calc_method=settings.calc_method,
        madhab=settings.madhab,
        reminder_interval_min=settings.reminder_interval_min,
        critical_before_next_min=settings.critical_before_next_min,
        allow_late_mark=settings.allow_late_mark,
        updated_at=settings.updated_at,
    )


@router.put("/settings", response_model=PrayerSettingsOut)
async def upsert_prayer_settings(
    payload: PrayerSettingsUpsert, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> PrayerSettingsOut:
    settings = await _get_settings(db, user["username"])
    settings.mode = payload.mode
    settings.latitude = payload.latitude
    settings.longitude = payload.longitude
    settings.tz_offset_min = payload.tz_offset_min
    settings.calc_method = payload.calc_method
    settings.madhab = payload.madhab
    settings.reminder_interval_min = payload.reminder_interval_min
    settings.critical_before_next_min = payload.critical_before_next_min
    settings.allow_late_mark = payload.allow_late_mark
    await db.commit()
    await db.refresh(settings)
    return await get_prayer_settings(user=user, db=db)


@router.put("/manual/{day}", response_model=PrayerDayScheduleOut)
async def set_manual_schedule(
    day: str,
    payload: ManualPrayerTimes,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrayerDayScheduleOut:
    d = _parse_day(day)
    settings = await _get_settings(db, user["username"])
    settings.mode = "manual"
    await db.commit()

    hours = {
        "fajr": _local_hours_from_hhmm(payload.fajr_local),
        "dhuhr": _local_hours_from_hhmm(payload.dhuhr_local),
        "asr": _local_hours_from_hhmm(payload.asr_local),
        "maghrib": _local_hours_from_hhmm(payload.maghrib_local),
        "isha": _local_hours_from_hhmm(payload.isha_local),
    }
    hours = _normalize_monotonic(hours)
    fajr_at = _utc_from_local_hours(day=d, local_hours=hours["fajr"], tz_offset_min=settings.tz_offset_min)
    dhuhr_at = _utc_from_local_hours(day=d, local_hours=hours["dhuhr"], tz_offset_min=settings.tz_offset_min)
    asr_at = _utc_from_local_hours(day=d, local_hours=hours["asr"], tz_offset_min=settings.tz_offset_min)
    maghrib_at = _utc_from_local_hours(day=d, local_hours=hours["maghrib"], tz_offset_min=settings.tz_offset_min)
    isha_at = _utc_from_local_hours(day=d, local_hours=hours["isha"], tz_offset_min=settings.tz_offset_min)

    res = await db.execute(select(PrayerDaySchedule).where(PrayerDaySchedule.username == user["username"], PrayerDaySchedule.day == d))
    schedule = res.scalars().first()
    if schedule is None:
        schedule = PrayerDaySchedule(
            username=user["username"],
            day=d,
            source="manual",
            fajr_at=fajr_at,
            dhuhr_at=dhuhr_at,
            asr_at=asr_at,
            maghrib_at=maghrib_at,
            isha_at=isha_at,
        )
        db.add(schedule)
    else:
        schedule.source = "manual"
        schedule.fajr_at = fajr_at
        schedule.dhuhr_at = dhuhr_at
        schedule.asr_at = asr_at
        schedule.maghrib_at = maghrib_at
        schedule.isha_at = isha_at
    await db.commit()
    await db.refresh(schedule)

    await _ensure_prayer_logs(db, username=user["username"], day=d, schedule=schedule)
    return PrayerDayScheduleOut(
        day=schedule.day.isoformat(),
        source=schedule.source,  # type: ignore[arg-type]
        fajr_at=schedule.fajr_at,
        dhuhr_at=schedule.dhuhr_at,
        asr_at=schedule.asr_at,
        maghrib_at=schedule.maghrib_at,
        isha_at=schedule.isha_at,
    )


@router.get("/today", response_model=PrayerTodayOut)
async def today(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    day: str | None = Query(default=None),
) -> PrayerTodayOut:
    d = _parse_day(day) if day else datetime.utcnow().date()
    settings = await _get_settings(db, user["username"])

    schedule = await _get_or_compute_schedule(db, username=user["username"], day=d, settings=settings)
    prayer_logs = await _ensure_prayer_logs(db, username=user["username"], day=d, schedule=schedule)

    res_ib = await db.execute(select(IbadahLog).where(IbadahLog.username == user["username"], IbadahLog.day == d))
    ib_logs = {r.ibadah_type: r for r in res_ib.scalars().all()}
    ib_settings = await _get_ibadah_settings(db, user["username"])
    enabled = set(json.loads(ib_settings.enabled_types_json))
    ib_points_today = sum(int(l.points) for l in ib_logs.values())
    prayer_points_today = sum(int(l.points) for l in prayer_logs)
    points_today = prayer_points_today + ib_points_today

    max_points = 5 * 10 + (len(enabled) * 5)
    rating_today = _rating(points_today, max_points)

    return PrayerTodayOut(
        schedule=PrayerDayScheduleOut(
            day=schedule.day.isoformat(),
            source=schedule.source,  # type: ignore[arg-type]
            fajr_at=schedule.fajr_at,
            dhuhr_at=schedule.dhuhr_at,
            asr_at=schedule.asr_at,
            maghrib_at=schedule.maghrib_at,
            isha_at=schedule.isha_at,
        ),
        logs=[
            PrayerLogOut(
                prayer=l.prayer,  # type: ignore[arg-type]
                scheduled_at=l.scheduled_at,
                next_prayer_at=l.next_prayer_at,
                status=l.status,  # type: ignore[arg-type]
                bucket=l.bucket,
                points=int(l.points),
                marked_at=l.marked_at,
            )
            for l in prayer_logs
        ],
        points_today=int(points_today),
        rating_today=float(rating_today),
    )


@router.post("/mark/{day}/{prayer}", response_model=PrayerLogOut)
async def mark_prayer(
    day: str,
    prayer: str,
    payload: PrayerMarkRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrayerLogOut:
    if prayer not in PRAYERS:
        raise HTTPException(status_code=400, detail="Invalid prayer")
    d = _parse_day(day)

    settings = await _get_settings(db, user["username"])
    schedule = await _get_or_compute_schedule(db, username=user["username"], day=d, settings=settings)
    await _ensure_prayer_logs(db, username=user["username"], day=d, schedule=schedule)

    res = await db.execute(
        select(PrayerLog).where(PrayerLog.username == user["username"], PrayerLog.day == d, PrayerLog.prayer == prayer)
    )
    log = res.scalars().first()
    if log is None:
        raise HTTPException(status_code=404, detail="Prayer log not found")

    marked_at = payload.marked_at_utc or datetime.utcnow()
    if not settings.allow_late_mark and log.next_prayer_at is not None and marked_at >= log.next_prayer_at:
        raise HTTPException(status_code=400, detail="Late marking is disabled")

    log.status = payload.status
    log.marked_at = marked_at
    log.note = payload.note

    bucket, points = _score_prayer(
        scheduled_at=log.scheduled_at,
        next_prayer_at=log.next_prayer_at,
        marked_at=marked_at,
        status=payload.status,
    )
    log.bucket = bucket
    log.points = points
    await db.commit()
    await db.refresh(log)

    return PrayerLogOut(
        prayer=log.prayer,  # type: ignore[arg-type]
        scheduled_at=log.scheduled_at,
        next_prayer_at=log.next_prayer_at,
        status=log.status,  # type: ignore[arg-type]
        bucket=log.bucket,
        points=int(log.points),
        marked_at=log.marked_at,
    )


@router.get("/ibadah/settings", response_model=IbadahSettingsOut)
async def get_ibadah_settings(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> IbadahSettingsOut:
    settings = await _get_ibadah_settings(db, user["username"])
    try:
        enabled = json.loads(settings.enabled_types_json)
    except Exception:
        enabled = IBADAH_TYPES
    return IbadahSettingsOut(username=settings.username, enabled_types=enabled, updated_at=settings.updated_at)


@router.put("/ibadah/settings", response_model=IbadahSettingsOut)
async def upsert_ibadah_settings(
    payload: IbadahSettingsUpsert, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> IbadahSettingsOut:
    settings = await _get_ibadah_settings(db, user["username"])
    settings.enabled_types_json = json.dumps(payload.enabled_types)
    await db.commit()
    await db.refresh(settings)
    return await get_ibadah_settings(user=user, db=db)


@router.post("/ibadah/mark/{day}/{ibadah_type}", response_model=IbadahLogOut)
async def mark_ibadah(
    day: str,
    ibadah_type: str,
    payload: IbadahMarkRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IbadahLogOut:
    if ibadah_type not in IBADAH_TYPES:
        raise HTTPException(status_code=400, detail="Invalid ibadah type")
    d = _parse_day(day)
    settings = await _get_ibadah_settings(db, user["username"])
    enabled = set(json.loads(settings.enabled_types_json))
    if ibadah_type not in enabled:
        raise HTTPException(status_code=400, detail="Ibadah type not enabled")

    res = await db.execute(
        select(IbadahLog).where(IbadahLog.username == user["username"], IbadahLog.day == d, IbadahLog.ibadah_type == ibadah_type)
    )
    log = res.scalars().first()
    if log is None:
        log = IbadahLog(username=user["username"], day=d, ibadah_type=ibadah_type)
        db.add(log)

    log.status = payload.status
    log.duration_min = payload.duration_min
    log.marked_at = payload.marked_at_utc or datetime.utcnow()
    log.points = 5 if payload.status == "completed" else 0
    await db.commit()
    await db.refresh(log)
    return IbadahLogOut(
        ibadah_type=log.ibadah_type,  # type: ignore[arg-type]
        status=log.status,  # type: ignore[arg-type]
        points=int(log.points),
        duration_min=log.duration_min,
        marked_at=log.marked_at,
    )


@router.get("/stats", response_model=PrayerStatsOut)
async def stats(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=30, ge=1, le=366),
) -> PrayerStatsOut:
    today = datetime.utcnow().date()
    since = today - timedelta(days=days - 1)

    stmt = (
        select(PrayerLog.day, func.sum(PrayerLog.points))
        .where(PrayerLog.username == user["username"], PrayerLog.day >= since)
        .group_by(PrayerLog.day)
        .order_by(PrayerLog.day)
    )
    res = await db.execute(stmt)
    prayer_by_day = {d: int(p or 0) for d, p in res.fetchall()}

    stmt2 = (
        select(IbadahLog.day, func.sum(IbadahLog.points))
        .where(IbadahLog.username == user["username"], IbadahLog.day >= since)
        .group_by(IbadahLog.day)
        .order_by(IbadahLog.day)
    )
    res2 = await db.execute(stmt2)
    ibadah_by_day = {d: int(p or 0) for d, p in res2.fetchall()}

    # MTD
    month_start = today.replace(day=1)
    mtd_stmt = (
        select(func.sum(PrayerLog.points))
        .where(PrayerLog.username == user["username"], PrayerLog.day >= month_start, PrayerLog.day <= today)
    )
    mtd_pr = await db.execute(mtd_stmt)
    mtd_pr_points = int(mtd_pr.scalar() or 0)

    mtd_ib_stmt = (
        select(func.sum(IbadahLog.points))
        .where(IbadahLog.username == user["username"], IbadahLog.day >= month_start, IbadahLog.day <= today)
    )
    mtd_ib = await db.execute(mtd_ib_stmt)
    mtd_ib_points = int(mtd_ib.scalar() or 0)

    days_out: list[dict] = []
    cur = since
    while cur <= today:
        days_out.append(
            {
                "day": cur.isoformat(),
                "points": int(prayer_by_day.get(cur, 0) + ibadah_by_day.get(cur, 0)),
                "prayer_points": int(prayer_by_day.get(cur, 0)),
                "ibadah_points": int(ibadah_by_day.get(cur, 0)),
            }
        )
        cur += timedelta(days=1)

    return PrayerStatsOut(points_mtd=int(mtd_pr_points + mtd_ib_points), days=days_out)


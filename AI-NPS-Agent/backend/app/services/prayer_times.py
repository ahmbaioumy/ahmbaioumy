from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from math import acos, atan, cos, degrees, pi, radians, sin, tan

PRAYER_ORDER = ["fajr", "dhuhr", "asr", "maghrib", "isha"]


@dataclass(frozen=True)
class PrayerTimeConfig:
    fajr_angle: float
    isha_angle: float
    asr_shadow_factor: int
    timezone_offset_minutes: int


def _clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


def _sun_position(day: date) -> tuple[float, float]:
    n = day.timetuple().tm_yday
    gamma = 2.0 * pi / 365.0 * (n - 1)
    eq_time = 229.18 * (
        0.000075
        + 0.001868 * cos(gamma)
        - 0.032077 * sin(gamma)
        - 0.014615 * cos(2.0 * gamma)
        - 0.040849 * sin(2.0 * gamma)
    )
    decl = (
        0.006918
        - 0.399912 * cos(gamma)
        + 0.070257 * sin(gamma)
        - 0.006758 * cos(2.0 * gamma)
        + 0.000907 * sin(2.0 * gamma)
        - 0.002697 * cos(3.0 * gamma)
        + 0.00148 * sin(3.0 * gamma)
    )
    return decl, eq_time


def _solar_noon_minutes(longitude_deg: float, eq_time: float, tz_offset_minutes: int) -> float:
    return 720.0 - 4.0 * longitude_deg - eq_time + tz_offset_minutes


def _hour_angle(lat_rad: float, decl_rad: float, zenith_deg: float) -> float:
    cos_ha = (cos(radians(zenith_deg)) - sin(lat_rad) * sin(decl_rad)) / (cos(lat_rad) * cos(decl_rad))
    cos_ha = _clamp(cos_ha)
    return degrees(acos(cos_ha))


def _asr_hour_angle(lat_rad: float, decl_rad: float, shadow_factor: int) -> float:
    angle = atan(1.0 / (shadow_factor + tan(abs(lat_rad - decl_rad))))
    cos_ha = (sin(angle) - sin(lat_rad) * sin(decl_rad)) / (cos(lat_rad) * cos(decl_rad))
    cos_ha = _clamp(cos_ha)
    return degrees(acos(cos_ha))


def _minutes_to_datetime(day: date, minutes: float) -> datetime:
    minutes = max(0.0, min(1440.0, minutes))
    return datetime.combine(day, time(0, 0)) + timedelta(minutes=minutes)


def calculate_prayer_times(
    day: date,
    latitude: float,
    longitude: float,
    config: PrayerTimeConfig,
) -> dict[str, datetime]:
    lat_rad = radians(latitude)
    decl, eq_time = _sun_position(day)
    solar_noon = _solar_noon_minutes(longitude, eq_time, config.timezone_offset_minutes)

    sunrise_ha = _hour_angle(lat_rad, decl, 90.833)
    sunrise = solar_noon - sunrise_ha * 4.0
    sunset = solar_noon + sunrise_ha * 4.0

    fajr_ha = _hour_angle(lat_rad, decl, 90.0 + config.fajr_angle)
    fajr = solar_noon - fajr_ha * 4.0

    isha_ha = _hour_angle(lat_rad, decl, 90.0 + config.isha_angle)
    isha = solar_noon + isha_ha * 4.0

    asr_ha = _asr_hour_angle(lat_rad, decl, config.asr_shadow_factor)
    asr = solar_noon + asr_ha * 4.0

    return {
        "fajr": _minutes_to_datetime(day, fajr),
        "dhuhr": _minutes_to_datetime(day, solar_noon),
        "asr": _minutes_to_datetime(day, asr),
        "maghrib": _minutes_to_datetime(day, sunset),
        "isha": _minutes_to_datetime(day, isha),
        "sunrise": _minutes_to_datetime(day, sunrise),
    }

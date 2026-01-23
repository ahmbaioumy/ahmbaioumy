from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import math


@dataclass(frozen=True)
class CalcParams:
    fajr_angle: float
    isha_angle: float | None
    isha_minutes: float | None


METHODS: dict[str, CalcParams] = {
    "MWL": CalcParams(fajr_angle=18.0, isha_angle=17.0, isha_minutes=None),
    "ISNA": CalcParams(fajr_angle=15.0, isha_angle=15.0, isha_minutes=None),
    "Egypt": CalcParams(fajr_angle=19.5, isha_angle=17.5, isha_minutes=None),
    "Makkah": CalcParams(fajr_angle=18.5, isha_angle=None, isha_minutes=90.0),
    "Karachi": CalcParams(fajr_angle=18.0, isha_angle=18.0, isha_minutes=None),
}


def _deg2rad(d: float) -> float:
    return d * math.pi / 180.0


def _rad2deg(r: float) -> float:
    return r * 180.0 / math.pi


def _fix_angle(a: float) -> float:
    a = a % 360.0
    return a + 360.0 if a < 0 else a


def _fix_hour(h: float) -> float:
    h = h % 24.0
    return h + 24.0 if h < 0 else h


def _julian_day(d: date) -> float:
    y, m, day = d.year, d.month, d.day
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + (a // 4)
    jd = int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + day + b - 1524.5
    return float(jd)


def _sun_position(jd: float) -> tuple[float, float]:
    # Returns declination (deg) and equation of time (hours)
    d = jd - 2451545.0
    g = _fix_angle(357.529 + 0.98560028 * d)
    q = _fix_angle(280.459 + 0.98564736 * d)
    l = _fix_angle(q + 1.915 * math.sin(_deg2rad(g)) + 0.020 * math.sin(_deg2rad(2 * g)))
    e = 23.439 - 0.00000036 * d

    ra = _rad2deg(math.atan2(math.cos(_deg2rad(e)) * math.sin(_deg2rad(l)), math.cos(_deg2rad(l)))) / 15.0
    ra = _fix_hour(ra)
    eqt = q / 15.0 - ra

    decl = _rad2deg(math.asin(math.sin(_deg2rad(e)) * math.sin(_deg2rad(l))))
    return decl, eqt


def _mid_day(eqt: float, longitude: float) -> float:
    return _fix_hour(12.0 - eqt - longitude / 15.0)


def _sun_angle_time(angle_deg: float, decl_deg: float, latitude: float, mid_day_h: float, direction: str) -> float:
    # direction: "ccw" => before midday, "cw" => after midday
    lat_r = _deg2rad(latitude)
    decl_r = _deg2rad(decl_deg)
    angle_r = _deg2rad(angle_deg)

    cos_omega = (math.sin(angle_r) - math.sin(lat_r) * math.sin(decl_r)) / (math.cos(lat_r) * math.cos(decl_r))
    # Clamp to avoid NaN around polar regions
    cos_omega = max(-1.0, min(1.0, cos_omega))
    omega = _rad2deg(math.acos(cos_omega)) / 15.0
    if direction == "ccw":
        return _fix_hour(mid_day_h - omega)
    return _fix_hour(mid_day_h + omega)


def _asr_time(shadow_factor: float, decl_deg: float, latitude: float, mid_day_h: float) -> float:
    lat_r = _deg2rad(latitude)
    decl_r = _deg2rad(decl_deg)
    angle = -_rad2deg(math.atan(1.0 / (shadow_factor + math.tan(abs(lat_r - decl_r)))))
    return _sun_angle_time(angle, decl_deg, latitude, mid_day_h, "cw")


def compute_prayer_times_local_hours(
    *,
    d: date,
    latitude: float,
    longitude: float,
    tz_offset_min: int,
    method: str,
    madhab: str,
) -> dict[str, float]:
    """
    Returns local times in hours [0,24) for: fajr, sunrise, dhuhr, asr, maghrib, isha.
    tz_offset_min: minutes offset from UTC, like JS Date().getTimezoneOffset().
      local_time = utc_time - tz_offset_min.
    """
    params = METHODS.get(method) or METHODS["MWL"]
    shadow = 2.0 if madhab == "hanafi" else 1.0

    # approximate by shifting JD to local noon using time zone
    jd = _julian_day(d) - (tz_offset_min / 60.0) / 24.0
    decl, eqt = _sun_position(jd)
    mid = _mid_day(eqt, longitude)

    sunrise = _sun_angle_time(-0.833, decl, latitude, mid, "ccw")
    maghrib = _sun_angle_time(-0.833, decl, latitude, mid, "cw")
    fajr = _sun_angle_time(-params.fajr_angle, decl, latitude, mid, "ccw")

    dhuhr = mid
    asr = _asr_time(shadow, decl, latitude, mid)

    if params.isha_minutes is not None:
        isha = _fix_hour(maghrib + params.isha_minutes / 60.0)
    else:
        isha_angle = params.isha_angle if params.isha_angle is not None else 17.0
        isha = _sun_angle_time(-isha_angle, decl, latitude, mid, "cw")

    return {
        "fajr": fajr,
        "sunrise": sunrise,
        "dhuhr": dhuhr,
        "asr": asr,
        "maghrib": maghrib,
        "isha": isha,
    }


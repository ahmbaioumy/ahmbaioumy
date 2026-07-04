"""Single source of truth for date parsing across the pipeline."""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum


class DateOrder(str, Enum):
    DMY = "DMY"
    MDY = "MDY"
    YMD = "YMD"


_FORMATS: dict[DateOrder, list[str]] = {
    DateOrder.DMY: ["%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y"],
    DateOrder.MDY: ["%m/%d/%Y %H:%M", "%m-%d-%Y %H:%M", "%m/%d/%Y", "%m-%d-%Y"],
    DateOrder.YMD: ["%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M", "%Y-%m-%d", "%Y/%m/%d"],
}


def _has_unambiguous_day(value: str) -> bool:
    for sep in ("/", "-"):
        parts = value.split(sep)
        if len(parts) >= 2:
            try:
                first = int(parts[0])
                second = int(parts[1])
                if first > 12 or second > 12:
                    return True
            except ValueError:
                continue
    return False


def _infer_order_from_unambiguous(values: list[str]) -> DateOrder | None:
    dmy_score = 0
    mdy_score = 0
    ymd_score = 0

    for value in values:
        if not value or not value.strip():
            continue
        text = value.strip()
        if re.match(r"^\d{4}", text):
            ymd_score += 2
            continue
        if not _has_unambiguous_day(text):
            continue
        for sep in ("/", "-"):
            parts = text.split(sep)
            if len(parts) < 2:
                continue
            try:
                first = int(parts[0])
                second = int(parts[1])
            except ValueError:
                continue
            if first > 12:
                dmy_score += 1
            if second > 12:
                mdy_score += 1

    if ymd_score > max(dmy_score, mdy_score):
        return DateOrder.YMD
    if dmy_score > mdy_score:
        return DateOrder.DMY
    if mdy_score > dmy_score:
        return DateOrder.MDY
    return None


def resolve_date_format(values: list[str], default: DateOrder = DateOrder.DMY) -> tuple[DateOrder, str]:
    """Resolve date convention once from the whole file using unambiguous rows."""
    order = _infer_order_from_unambiguous(values)
    if order is None:
        order = default
    fmt = _FORMATS[order][0]
    return order, fmt


def parse_datetime(value: str, order: DateOrder) -> datetime:
    text = value.strip()
    for fmt in _FORMATS[order]:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date '{value}' with order {order.value}")


def parse_series(values: list[str], order: DateOrder | None = None) -> tuple[list[datetime], DateOrder, str]:
    non_empty = [v for v in values if v and str(v).strip()]
    if not non_empty:
        raise ValueError("No date values to parse")
    resolved_order, fmt = resolve_date_format(non_empty) if order is None else (order, _FORMATS[order][0])
    parsed = [parse_datetime(v, resolved_order) for v in values if v and str(v).strip()]
    return parsed, resolved_order, fmt

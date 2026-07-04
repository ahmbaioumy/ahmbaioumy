"""File import/export and profile persistence."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from core.datetime.parser import parse_series, resolve_date_format
from core.models import Profile, RawUpload, ValidationIssue

EXPECTED_COLUMNS = {
    "timestamp": ["timestamp", "datetime", "date", "time", "interval"],
    "volume": ["volume", "calls", "contacts", "interactions", "count"],
    "aht": ["aht", "handle_time", "avg_handle_time", "talk_time"],
}


def _match_column(headers: list[str], aliases: list[str]) -> str | None:
    lower = {h.lower().strip(): h for h in headers}
    for alias in aliases:
        if alias in lower:
            return lower[alias]
    return None


def auto_map_columns(headers: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for canonical, aliases in EXPECTED_COLUMNS.items():
        matched = _match_column(headers, aliases)
        if matched:
            mapping[canonical] = matched
    return mapping


def load_upload(file_path: str | Path, column_mapping: dict[str, str] | None = None) -> RawUpload:
    path = Path(file_path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)

    headers = list(df.columns)
    mapping = column_mapping or auto_map_columns(headers)
    issues: list[ValidationIssue] = []

    if "timestamp" not in mapping:
        issues.append(ValidationIssue("error", "MISSING_TIMESTAMP", "No timestamp column found or mapped"))
    if "volume" not in mapping:
        issues.append(ValidationIssue("error", "MISSING_VOLUME", "No volume column found or mapped"))

    rows: list[dict[str, Any]] = []
    date_values = df[mapping["timestamp"]].astype(str).tolist() if "timestamp" in mapping else []

    order, fmt = resolve_date_format(date_values) if date_values else (None, "")
    timestamps: list[datetime] = []
    if date_values and order is not None:
        timestamps, order, fmt = parse_series(date_values, order)

    seen: set[datetime] = set()
    for i, record in enumerate(df.to_dict(orient="records")):
        row: dict[str, Any] = {}
        if "timestamp" in mapping and i < len(timestamps):
            row["timestamp"] = timestamps[i]
            if row["timestamp"] in seen:
                issues.append(ValidationIssue("warning", "DUPLICATE_TIMESTAMP", f"Duplicate timestamp at row {i}", i))
            seen.add(row["timestamp"])
        if "volume" in mapping:
            vol = float(record.get(mapping["volume"], 0) or 0)
            row["volume"] = vol
            if vol < 0:
                issues.append(ValidationIssue("error", "NEGATIVE_VOLUME", f"Negative volume at row {i}", i))
        if "aht" in mapping:
            row["aht"] = float(record.get(mapping["aht"], 0) or 0)
        rows.append(row)

    date_range = None
    if timestamps:
        date_range = (min(timestamps), max(timestamps))

    return RawUpload(
        rows=rows,
        date_format=fmt,
        granularity_minutes=30,
        column_mapping=mapping,
        issues=issues,
        date_range=date_range,
    )


def save_profile(profile: Profile, path: str | Path) -> None:
    Path(path).write_text(json.dumps(profile.to_dict(), indent=2))


def load_profile(path: str | Path) -> Profile:
    data = json.loads(Path(path).read_text())
    return Profile.from_dict(data)


def export_report_excel(report_data: dict[str, Any], path: str | Path) -> None:
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name, rows in report_data.get("sheets", {}).items():
            pd.DataFrame(rows).to_excel(writer, sheet_name=sheet_name[:31], index=False)

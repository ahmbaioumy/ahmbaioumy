"""Anomaly detection and genuinely distinct imputation strategies."""

from __future__ import annotations

import statistics
from typing import Callable


def detect_spikes(values: list[float], z_threshold: float = 3.0) -> list[int]:
    if len(values) < 3:
        return []
    mean = statistics.mean(values)
    stdev = statistics.stdev(values)
    if stdev == 0:
        return []
    return [i for i, v in enumerate(values) if abs(v - mean) > z_threshold * stdev]


def detect_zeros_runs(values: list[float], min_run: int = 3) -> list[int]:
    indices: list[int] = []
    run_start = None
    for i, v in enumerate(values):
        if v == 0:
            if run_start is None:
                run_start = i
        else:
            if run_start is not None and i - run_start >= min_run:
                indices.extend(range(run_start, i))
            run_start = None
    if run_start is not None and len(values) - run_start >= min_run:
        indices.extend(range(run_start, len(values)))
    return indices


def impute_median(values: list[float], anomaly_indices: list[int]) -> tuple[list[float], list[dict]]:
    result = list(values)
    changes: list[dict] = []
    clean = [v for i, v in enumerate(values) if i not in anomaly_indices and v is not None]
    fill = statistics.median(clean) if clean else 0.0
    for idx in anomaly_indices:
        old = result[idx]
        result[idx] = fill
        changes.append({"index": idx, "old": old, "new": fill, "method": "median"})
    return result, changes


def impute_linear_interpolation(values: list[float], anomaly_indices: list[int]) -> tuple[list[float], list[dict]]:
    result = list(values)
    changes: list[dict] = []
    anomaly_set = set(anomaly_indices)
    for idx in sorted(anomaly_indices):
        old = result[idx]
        prev_val = None
        next_val = None
        for j in range(idx - 1, -1, -1):
            if j not in anomaly_set:
                prev_val = result[j]
                break
        for j in range(idx + 1, len(result)):
            if j not in anomaly_set:
                next_val = result[j]
                break
        if prev_val is not None and next_val is not None:
            new = (prev_val + next_val) / 2.0
        elif prev_val is not None:
            new = prev_val
        elif next_val is not None:
            new = next_val
        else:
            new = 0.0
        result[idx] = new
        changes.append({"index": idx, "old": old, "new": new, "method": "linear_interpolation"})
    return result, changes


def impute_rolling_mean(values: list[float], anomaly_indices: list[int], window: int = 5) -> tuple[list[float], list[dict]]:
    result = list(values)
    changes: list[dict] = []
    anomaly_set = set(anomaly_indices)
    for idx in anomaly_indices:
        old = result[idx]
        neighbors = [
            result[j]
            for j in range(max(0, idx - window), min(len(result), idx + window + 1))
            if j not in anomaly_set
        ]
        new = statistics.mean(neighbors) if neighbors else 0.0
        result[idx] = new
        changes.append({"index": idx, "old": old, "new": new, "method": "rolling_mean"})
    return result, changes


IMPUTATION_METHODS: dict[str, Callable[[list[float], list[int]], tuple[list[float], list[dict]]]] = {
    "median": impute_median,
    "linear_interpolation": impute_linear_interpolation,
    "rolling_mean": impute_rolling_mean,
}


def apply_cleansing(
    values: list[float],
    method: str,
    z_threshold: float = 3.0,
) -> tuple[list[float], list[dict], list[int]]:
    anomalies = list(set(detect_spikes(values, z_threshold) + detect_zeros_runs(values)))
    if method not in IMPUTATION_METHODS:
        raise ValueError(f"Unknown cleansing method: {method}")
    cleaned, changes = IMPUTATION_METHODS[method](values, anomalies)
    return cleaned, changes, anomalies

"""Forecast models with automatic selection by holdout accuracy."""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np

from core.models import Forecast, ForecastPoint


def _wmape(actual: np.ndarray, predicted: np.ndarray) -> float:
    denom = np.sum(np.abs(actual))
    if denom == 0:
        return 0.0
    return float(np.sum(np.abs(actual - predicted)) / denom * 100.0)


def _mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual != 0
    if not np.any(mask):
        return 0.0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100.0)


def _bias(actual: np.ndarray, predicted: np.ndarray) -> float:
    if len(actual) == 0:
        return 0.0
    return float(np.mean(predicted - actual))


def forecast_naive(history: list[float], horizon: int) -> list[float]:
    last = history[-1] if history else 0.0
    return [last] * horizon


def forecast_moving_average(history: list[float], horizon: int, window: int = 7) -> list[float]:
    if not history:
        return [0.0] * horizon
    avg = float(np.mean(history[-window:]))
    return [avg] * horizon


def forecast_seasonal_naive(history: list[float], horizon: int, season: int = 7) -> list[float]:
    if len(history) < season:
        return forecast_moving_average(history, horizon)
    result = []
    for i in range(horizon):
        idx = len(history) - season + (i % season)
        result.append(history[idx])
    return result


def forecast_linear_trend(history: list[float], horizon: int) -> list[float]:
    if len(history) < 2:
        return forecast_naive(history, horizon)
    x = np.arange(len(history))
    coeffs = np.polyfit(x, history, 1)
    result = []
    for i in range(horizon):
        result.append(float(coeffs[0] * (len(history) + i) + coeffs[1]))
    return [max(0.0, v) for v in result]


MODELS = {
    "naive": forecast_naive,
    "moving_average": forecast_moving_average,
    "seasonal_naive": forecast_seasonal_naive,
    "linear_trend": forecast_linear_trend,
}


def select_and_forecast(
    timestamps: list[datetime],
    volumes: list[float],
    horizon: int,
    holdout: int | None = None,
) -> Forecast:
    if not volumes:
        return Forecast(
            points=[],
            model_name="none",
            accuracy_wmape=None,
            accuracy_mape=None,
            bias=None,
            fallback_used=True,
            fallback_reason="No historical data",
        )

    holdout = holdout or max(1, min(7, len(volumes) // 5))
    fallback_used = False
    fallback_reason = None

    if len(volumes) < holdout + 2:
        fallback_used = True
        fallback_reason = f"Insufficient history ({len(volumes)} points) for holdout validation"
        preds = forecast_moving_average(volumes, horizon)
        model_name = "moving_average"
        wmape = mape = bias = None
    else:
        train = volumes[:-holdout]
        test = np.array(volumes[-holdout:])
        best_name = "moving_average"
        best_wmape = float("inf")
        best_preds_holdout: list[float] = []

        for name, fn in MODELS.items():
            try:
                preds_holdout = fn(train, holdout)
                score = _wmape(test, np.array(preds_holdout))
                if score < best_wmape:
                    best_wmape = score
                    best_name = name
                    best_preds_holdout = preds_holdout
            except Exception:
                continue

        model_name = best_name
        preds = MODELS[model_name](volumes, horizon)
        wmape = _wmape(test, np.array(best_preds_holdout))
        mape = _mape(test, np.array(best_preds_holdout))
        bias = _bias(test, np.array(best_preds_holdout))

    last_ts = timestamps[-1] if timestamps else datetime.now()
    delta = timedelta(days=1)
    if len(timestamps) >= 2:
        delta = timestamps[1] - timestamps[0]

    points = [
        ForecastPoint(
            timestamp=last_ts + delta * (i + 1),
            volume=max(0.0, preds[i]),
        )
        for i in range(horizon)
    ]

    return Forecast(
        points=points,
        model_name=model_name,
        accuracy_wmape=wmape,
        accuracy_mape=mape,
        bias=bias,
        fallback_used=fallback_used,
        fallback_reason=fallback_reason,
    )

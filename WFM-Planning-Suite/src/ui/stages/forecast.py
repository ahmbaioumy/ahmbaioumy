"""Forecasting stage."""

from __future__ import annotations

from PySide6.QtWidgets import QLabel, QSpinBox, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from core.forecasting.selector import select_and_forecast
from ui.widgets import approximation_badge


class ForecastStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.forecast = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Forecast</h2>"))

        self.horizon = QSpinBox()
        self.horizon.setRange(1, 90)
        self.horizon.setValue(14)
        self.horizon.setSuffix(" days")
        layout.addWidget(QLabel("Forecast Horizon:"))
        layout.addWidget(self.horizon)

        self.model_label = QLabel("Model: —")
        layout.addWidget(self.model_label)
        self.accuracy_label = QLabel("Accuracy: —")
        layout.addWidget(self.accuracy_label)
        self.badge_container = QVBoxLayout()
        layout.addLayout(self.badge_container)

        self.table = QTableWidget()
        self.table.setColumnCount(2)
        self.table.setHorizontalHeaderLabels(["Date", "Volume"])
        layout.addWidget(self.table)

    def on_enter(self, data: dict):
        cleansed = data.get("cleansed")
        if not cleansed:
            return

        timestamps = [r["timestamp"] for r in cleansed.rows if r.get("timestamp")]
        volumes = [float(r.get("volume", 0)) for r in cleansed.rows if r.get("timestamp")]

        daily: dict = {}
        for ts, vol in zip(timestamps, volumes):
            key = ts.date()
            daily[key] = daily.get(key, 0) + vol

        sorted_days = sorted(daily.keys())
        day_ts = [__import__("datetime").datetime.combine(d, __import__("datetime").time()) for d in sorted_days]
        day_vol = [daily[d] for d in sorted_days]

        self.forecast = select_and_forecast(day_ts, day_vol, self.horizon.value())
        self.model_label.setText(f"<b>Selected Model:</b> {self.forecast.model_name}")
        wmape = self.forecast.accuracy_wmape
        self.accuracy_label.setText(
            f"WMAPE: {wmape:.1f}%" if wmape is not None else "WMAPE: N/A (insufficient history)"
        )

        while self.badge_container.count():
            w = self.badge_container.takeAt(0).widget()
            if w:
                w.deleteLater()
        if self.forecast.fallback_used and self.forecast.fallback_reason:
            self.badge_container.addWidget(approximation_badge(self.forecast.fallback_reason))

        self.table.setRowCount(len(self.forecast.points))
        for i, pt in enumerate(self.forecast.points):
            self.table.setItem(i, 0, QTableWidgetItem(pt.timestamp.strftime("%Y-%m-%d")))
            self.table.setItem(i, 1, QTableWidgetItem(f"{pt.volume:.1f}"))

    def validate(self) -> bool:
        return self.forecast is not None and len(self.forecast.points) > 0

    def collect(self) -> dict:
        return {"forecast": self.forecast}

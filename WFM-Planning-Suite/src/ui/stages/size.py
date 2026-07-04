"""Sizing (Erlang) stage."""

from __future__ import annotations

from PySide6.QtWidgets import QLabel, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from core.sizing.orchestrator import derive_interval_pattern, size_intervals
from ui.widgets import approximation_badge


class SizeStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.sizing = None
        self.demand = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Staffing (Erlang Sizing)</h2>"))
        self.method_label = QLabel("")
        layout.addWidget(self.method_label)
        self.badge_container = QVBoxLayout()
        layout.addLayout(self.badge_container)

        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels([
            "Interval", "Volume", "Agents", "SLA %", "ASA (s)", "Abandon %",
        ])
        layout.addWidget(self.table)

    def on_enter(self, data: dict):
        profile = data.get("profile")
        forecast = data.get("forecast")
        cleansed = data.get("cleansed")
        if not profile or not forecast:
            return

        forecast_points = [{"timestamp": p.timestamp, "volume": p.volume} for p in forecast.points]
        historical = cleansed.rows if cleansed else []
        self.demand = derive_interval_pattern(historical, forecast_points, profile.interval_minutes)
        self.method_label.setText(f"<b>Interval Method:</b> {self.demand.interval_method.value}")

        while self.badge_container.count():
            w = self.badge_container.takeAt(0).widget()
            if w:
                w.deleteLater()
        for note in self.demand.approximations:
            self.badge_container.addWidget(approximation_badge(note))

        self.sizing = size_intervals(self.demand, profile)
        preview = self.sizing.rows[:200]
        self.table.setRowCount(len(preview))
        for i, row in enumerate(preview):
            self.table.setItem(i, 0, QTableWidgetItem(row.timestamp.strftime("%Y-%m-%d %H:%M")))
            self.table.setItem(i, 1, QTableWidgetItem(f"{row.volume:.1f}"))
            self.table.setItem(i, 2, QTableWidgetItem(str(row.agents_required)))
            self.table.setItem(i, 3, QTableWidgetItem(f"{row.sla_pct:.1f}"))
            self.table.setItem(i, 4, QTableWidgetItem(f"{row.asa_seconds:.1f}"))
            self.table.setItem(i, 5, QTableWidgetItem(f"{row.abandonment_pct:.1f}"))

    def validate(self) -> bool:
        return self.sizing is not None

    def collect(self) -> dict:
        return {"sizing": self.sizing, "demand": self.demand}

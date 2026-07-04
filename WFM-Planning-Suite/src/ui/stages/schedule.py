"""Scheduling stage."""

from __future__ import annotations

from PySide6.QtWidgets import QLabel, QSpinBox, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from core.scheduling.optimizer import build_schedule


class ScheduleStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.schedule = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Schedule</h2>"))

        self.headcount = QSpinBox()
        self.headcount.setRange(1, 500)
        self.headcount.setValue(50)
        self.headcount.setSuffix(" agents")
        layout.addWidget(QLabel("Available Headcount:"))
        layout.addWidget(self.headcount)

        self.warnings_label = QLabel("")
        self.warnings_label.setWordWrap(True)
        self.warnings_label.setStyleSheet("color: #e67e22;")
        layout.addWidget(self.warnings_label)

        self.table = QTableWidget()
        self.table.setColumnCount(3)
        self.table.setHorizontalHeaderLabels(["Agent", "Shift Start", "Shift End"])
        layout.addWidget(self.table)

    def on_enter(self, data: dict):
        sizing = data.get("sizing")
        if not sizing:
            return
        self.schedule = build_schedule(sizing, self.headcount.value())
        if self.schedule.warnings:
            self.warnings_label.setText("⚠ " + " | ".join(self.schedule.warnings))
        else:
            self.warnings_label.setText("")

        preview = self.schedule.assignments[:100]
        self.table.setRowCount(len(preview))
        for i, a in enumerate(preview):
            self.table.setItem(i, 0, QTableWidgetItem(a.agent_id))
            self.table.setItem(i, 1, QTableWidgetItem(a.shift_start.strftime("%Y-%m-%d %H:%M")))
            self.table.setItem(i, 2, QTableWidgetItem(a.shift_end.strftime("%Y-%m-%d %H:%M")))

    def validate(self) -> bool:
        sizing = self.main_window.pipeline_data.get("sizing")
        if sizing:
            self.schedule = build_schedule(sizing, self.headcount.value())
        return self.schedule is not None

    def collect(self) -> dict:
        return {"schedule": self.schedule, "headcount": self.headcount.value()}

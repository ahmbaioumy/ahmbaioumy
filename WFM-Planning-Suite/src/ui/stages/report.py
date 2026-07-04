"""Report generation and export stage."""

from __future__ import annotations

from PySide6.QtWidgets import QFileDialog, QLabel, QMessageBox, QPushButton, QVBoxLayout, QWidget

from core.reporting.generator import build_report, report_to_export_dict
from wfm_io.files import export_report_excel


class ReportStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.report = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Report</h2>"))
        self.summary = QLabel("")
        self.summary.setWordWrap(True)
        layout.addWidget(self.summary)

        export_btn = QPushButton("Export to Excel")
        export_btn.clicked.connect(self._export)
        layout.addWidget(export_btn)
        layout.addStretch()

    def on_enter(self, data: dict):
        profile = data.get("profile")
        forecast = data.get("forecast")
        sizing = data.get("sizing")
        schedule = data.get("schedule")
        simulation = data.get("simulation")
        if not all([profile, forecast, sizing, schedule]):
            return

        self.report = build_report(profile, forecast, sizing, schedule, simulation)
        lines = [f"<h3>{self.report.title}</h3>"]
        for section in self.report.sections:
            lines.append(f"<b>{section['title']}</b>")
            for item in section["items"]:
                unit = item.get("unit", "")
                val = item.get("value", "")
                lines.append(f"  {item['label']}: {val} {unit}".strip())
        self.summary.setText("<br>".join(lines))

    def _export(self):
        if not self.report:
            return
        path, _ = QFileDialog.getSaveFileName(self, "Save Report", "wfm_report.xlsx", "Excel (*.xlsx)")
        if not path:
            return
        sizing = self.main_window.pipeline_data.get("sizing")
        data = report_to_export_dict(self.report, sizing)
        try:
            export_report_excel(data, path)
            QMessageBox.information(self, "Export", f"Report saved to {path}")
        except Exception as e:
            QMessageBox.critical(self, "Export Error", str(e))

    def validate(self) -> bool:
        return True

    def collect(self) -> dict:
        return {"report": self.report}

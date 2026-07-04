"""Data cleansing stage."""

from __future__ import annotations

from PySide6.QtWidgets import (
    QComboBox,
    QLabel,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from core.cleansing.strategies import IMPUTATION_METHODS, apply_cleansing
from core.models import CleansedSeries


class CleanseStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.cleansed = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Data Cleansing</h2>"))

        self.method = QComboBox()
        self.method.addItems(list(IMPUTATION_METHODS.keys()))
        self.method.currentTextChanged.connect(self._run_cleansing)
        layout.addWidget(QLabel("Imputation Method:"))
        layout.addWidget(self.method)

        self.changes_table = QTableWidget()
        self.changes_table.setColumnCount(4)
        self.changes_table.setHorizontalHeaderLabels(["Row", "Old Value", "New Value", "Method"])
        layout.addWidget(self.changes_table)

    def on_enter(self, data: dict):
        upload = data.get("upload")
        if not upload:
            return
        self._run_cleansing()

    def _run_cleansing(self):
        upload = self.main_window.pipeline_data.get("upload")
        if not upload:
            return
        volumes = [float(r.get("volume", 0)) for r in upload.rows]
        method = self.method.currentText()
        cleaned, changes, _ = apply_cleansing(volumes, method)

        rows = []
        for i, row in enumerate(upload.rows):
            new_row = dict(row)
            new_row["volume"] = cleaned[i]
            rows.append(new_row)

        self.cleansed = CleansedSeries(rows=rows, method_applied=method, changes=changes)
        self.changes_table.setRowCount(len(changes))
        for i, c in enumerate(changes):
            self.changes_table.setItem(i, 0, QTableWidgetItem(str(c["index"])))
            self.changes_table.setItem(i, 1, QTableWidgetItem(f"{c['old']:.1f}"))
            self.changes_table.setItem(i, 2, QTableWidgetItem(f"{c['new']:.1f}"))
            self.changes_table.setItem(i, 3, QTableWidgetItem(c["method"]))

    def validate(self) -> bool:
        return self.cleansed is not None

    def collect(self) -> dict:
        return {"cleansed": self.cleansed}

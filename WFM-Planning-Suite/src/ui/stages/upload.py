"""Upload stage — ingest CSV/Excel historical data."""

from __future__ import annotations

from PySide6.QtWidgets import (
    QFileDialog,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from wfm_io.files import load_upload


class UploadStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.upload = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Upload Historical Data</h2>"))
        layout.addWidget(QLabel("Import CSV or Excel files with timestamp and volume columns."))

        self.summary = QLabel("No file loaded.")
        layout.addWidget(self.summary)

        btn = QPushButton("Browse File...")
        btn.clicked.connect(self._browse)
        layout.addWidget(btn)

        self.table = QTableWidget()
        self.table.setColumnCount(3)
        self.table.setHorizontalHeaderLabels(["Timestamp", "Volume", "AHT"])
        layout.addWidget(self.table)

    def _browse(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Select Data File", "", "Data Files (*.csv *.xlsx *.xls)"
        )
        if not path:
            return
        try:
            self.upload = load_upload(path)
        except Exception as e:
            QMessageBox.critical(self, "Upload Error", str(e))
            return

        errors = [i for i in self.upload.issues if i.severity == "error"]
        if errors:
            QMessageBox.warning(
                self, "Validation Issues",
                "\n".join(i.message for i in errors),
            )
            return

        n = len(self.upload.rows)
        dr = self.upload.date_range
        range_text = f"{dr[0].date()} to {dr[1].date()}" if dr else "unknown"
        warnings = [i for i in self.upload.issues if i.severity == "warning"]
        self.summary.setText(
            f"<b>{n}</b> rows loaded | Date range: {range_text} | "
            f"Format: {self.upload.date_format} | Issues: {len(warnings)}"
        )

        preview = self.upload.rows[:100]
        self.table.setRowCount(len(preview))
        for i, row in enumerate(preview):
            ts = row.get("timestamp")
            self.table.setItem(i, 0, QTableWidgetItem(str(ts) if ts else ""))
            self.table.setItem(i, 1, QTableWidgetItem(str(row.get("volume", ""))))
            self.table.setItem(i, 2, QTableWidgetItem(str(row.get("aht", ""))))

    def validate(self) -> bool:
        if not self.upload or not self.upload.rows:
            QMessageBox.warning(self, "Upload", "Please load a valid data file first.")
            return False
        return True

    def collect(self) -> dict:
        return {"upload": self.upload}

"""PySide6 main window with pipeline step navigator."""

from __future__ import annotations

from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtWidgets import (
    QHBoxLayout,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from ui.stages.cleanse import CleanseStage
from ui.stages.forecast import ForecastStage
from ui.stages.profile import ProfileStage
from ui.stages.report import ReportStage
from ui.stages.schedule import ScheduleStage
from ui.stages.simulate import SimulateStage
from ui.stages.size import SizeStage
from ui.stages.upload import UploadStage

STAGES = [
    ("Upload", UploadStage),
    ("Profile", ProfileStage),
    ("Cleanse", CleanseStage),
    ("Forecast", ForecastStage),
    ("Size", SizeStage),
    ("Schedule", ScheduleStage),
    ("Simulate", SimulateStage),
    ("Report", ReportStage),
]


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("WFM Planning Suite")
        self.resize(1200, 800)
        self.setStyleSheet("""
            QMainWindow { background: #f5f6fa; }
            QListWidget { background: #2c3e50; color: white; border: none; font-size: 14px; }
            QListWidget::item { padding: 12px 16px; }
            QListWidget::item:selected { background: #3498db; }
            QListWidget::item:disabled { color: #7f8c8d; }
            QPushButton#primary { background: #3498db; color: white; padding: 10px 24px;
                border: none; border-radius: 4px; font-weight: bold; }
            QPushButton#primary:hover { background: #2980b9; }
        """)

        self.pipeline_data: dict = {}
        self._completed: set[int] = set()

        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)

        self.nav = QListWidget()
        self.nav.setFixedWidth(200)
        for i, (name, _) in enumerate(STAGES):
            item = QListWidgetItem(name)
            item.setData(Qt.ItemDataRole.UserRole, i)
            if i > 0:
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEnabled)
            self.nav.addItem(item)
        self.nav.currentRowChanged.connect(self._on_nav_changed)
        layout.addWidget(self.nav)

        right = QVBoxLayout()
        self.stack = QStackedWidget()
        self.stages: list[QWidget] = []
        for _, cls in STAGES:
            stage = cls(self)
            self.stages.append(stage)
            self.stack.addWidget(stage)
        right.addWidget(self.stack, 1)

        self.next_btn = QPushButton("Next →")
        self.next_btn.setObjectName("primary")
        self.next_btn.clicked.connect(self._on_next)
        right.addWidget(self.next_btn, alignment=Qt.AlignmentFlag.AlignRight)
        layout.addLayout(right, 1)

        self.nav.setCurrentRow(0)

    def _on_nav_changed(self, index: int):
        if 0 <= index < len(self.stages):
            self.stack.setCurrentIndex(index)

    def _on_next(self):
        current = self.stack.currentIndex()
        stage = self.stages[current]
        if hasattr(stage, "validate") and not stage.validate():
            return
        if hasattr(stage, "collect"):
            self.pipeline_data.update(stage.collect())

        self._completed.add(current)
        item = self.nav.item(current)
        item.setText(f"✓ {STAGES[current][0]}")

        if current + 1 < len(STAGES):
            next_item = self.nav.item(current + 1)
            next_item.setFlags(next_item.flags() | Qt.ItemFlag.ItemIsEnabled)
            self.nav.setCurrentRow(current + 1)
            next_stage = self.stages[current + 1]
            if hasattr(next_stage, "on_enter"):
                next_stage.on_enter(self.pipeline_data)
        else:
            QMessageBox.information(self, "Complete", "Planning pipeline complete. View the Report stage.")

    def go_to_stage(self, index: int):
        if self.nav.item(index).flags() & Qt.ItemFlag.ItemIsEnabled:
            self.nav.setCurrentRow(index)


class WorkerThread(QThread):
    finished = Signal(object)
    error = Signal(str)
    progress = Signal(int, str)

    def __init__(self, fn, *args, **kwargs):
        super().__init__()
        self._fn = fn
        self._args = args
        self._kwargs = kwargs

    def run(self):
        try:
            result = self._fn(*self._args, **self._kwargs)
            self.finished.emit(result)
        except Exception as e:
            self.error.emit(str(e))

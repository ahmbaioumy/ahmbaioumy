"""Profile / configuration stage."""

from __future__ import annotations

from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from core.models import ChannelType, ErlangModel, Profile
from ui.widgets import help_label


class ProfileStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Planning Profile</h2>"))

        form = QFormLayout()
        self.name = QLineEdit("Default")
        form.addRow("Profile Name", self.name)

        self.sla_pct = QSpinBox()
        self.sla_pct.setRange(1, 100)
        self.sla_pct.setValue(80)
        self.sla_pct.setSuffix(" %")
        form.addRow(help_label("SLA Target", "SLA"), self.sla_pct)

        self.sla_time = QSpinBox()
        self.sla_time.setRange(1, 600)
        self.sla_time.setValue(20)
        self.sla_time.setSuffix(" sec")
        form.addRow(help_label("SLA Time", "SLA"), self.sla_time)

        self.aht = QSpinBox()
        self.aht.setRange(10, 3600)
        self.aht.setValue(300)
        self.aht.setSuffix(" sec")
        form.addRow(help_label("AHT", "AHT"), self.aht)

        self.shrinkage = QSpinBox()
        self.shrinkage.setRange(0, 80)
        self.shrinkage.setValue(30)
        self.shrinkage.setSuffix(" %")
        form.addRow(help_label("Shrinkage", "Shrinkage"), self.shrinkage)

        self.occupancy = QSpinBox()
        self.occupancy.setRange(50, 100)
        self.occupancy.setValue(85)
        self.occupancy.setSuffix(" %")
        form.addRow(help_label("Occupancy Target", "Occupancy"), self.occupancy)

        self.patience = QSpinBox()
        self.patience.setRange(10, 600)
        self.patience.setValue(120)
        self.patience.setSuffix(" sec")
        form.addRow(help_label("Patience", "Patience"), self.patience)

        self.channel = QComboBox()
        self.channel.addItems([c.value for c in ChannelType])
        form.addRow("Channel", self.channel)

        self.advanced = QCheckBox("Advanced mode")
        layout.addLayout(form)
        layout.addWidget(self.advanced)

        adv_row = QHBoxLayout()
        self.erlang_model = QComboBox()
        self.erlang_model.addItems(["erlang_c", "erlang_a", "erlang_b"])
        self.erlang_model.setEnabled(False)
        adv_row.addWidget(help_label("Erlang Model", "Erlang C"))
        adv_row.addWidget(self.erlang_model)
        layout.addLayout(adv_row)

        self.advanced.toggled.connect(lambda on: self.erlang_model.setEnabled(on))
        layout.addStretch()

    def validate(self) -> bool:
        return bool(self.name.text().strip())

    def collect(self) -> dict:
        profile = Profile(
            name=self.name.text().strip(),
            sla_target_pct=float(self.sla_pct.value()),
            sla_time_seconds=float(self.sla_time.value()),
            aht_seconds=float(self.aht.value()),
            shrinkage_pct=float(self.shrinkage.value()),
            occupancy_target_pct=float(self.occupancy.value()),
            patience_seconds=float(self.patience.value()),
            channel=ChannelType(self.channel.currentText()),
            erlang_model=ErlangModel(self.erlang_model.currentText()),
        )
        return {"profile": profile}

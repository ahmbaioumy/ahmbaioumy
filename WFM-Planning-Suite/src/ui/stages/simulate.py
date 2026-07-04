"""Simulation cross-validation stage."""

from __future__ import annotations

from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget

from core.simulation.des import cross_validate, run_simulation


class SimulateStage(QWidget):
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.simulation = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h2>Simulation Cross-Check</h2>"))
        layout.addWidget(QLabel(
            "Discrete-event simulation validates analytic Erlang sizing independently."
        ))
        self.results = QLabel("Run simulation by clicking Next.")
        layout.addWidget(self.results)
        layout.addStretch()

    def on_enter(self, data: dict):
        sizing = data.get("sizing")
        profile = data.get("profile")
        headcount = data.get("headcount", 50)
        if not sizing or not profile:
            return

        agents = min(headcount, max((r.agents_required for r in sizing.rows), default=1))
        self.simulation = run_simulation(
            sizing, profile.aht_seconds, profile.patience_seconds, agents
        )
        self.simulation = cross_validate(sizing, self.simulation)

        status = "✓ Passed" if self.simulation.cross_check_passed else "⚠ Review"
        self.results.setText(
            f"<b>Simulation Results</b><br>"
            f"SLA: {self.simulation.sla_pct:.1f}%<br>"
            f"ASA: {self.simulation.asa_seconds:.1f} sec<br>"
            f"Abandonment: {self.simulation.abandonment_pct:.1f}%<br>"
            f"Intervals simulated: {self.simulation.intervals_simulated} "
            f"(warm-up excluded)<br>"
            f"Cross-check: {status}<br>"
            f"<i>{self.simulation.cross_check_notes}</i>"
        )

    def validate(self) -> bool:
        return self.simulation is not None

    def collect(self) -> dict:
        return {"simulation": self.simulation}

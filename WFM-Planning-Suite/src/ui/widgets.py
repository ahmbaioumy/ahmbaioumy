"""Shared UI widgets."""

from __future__ import annotations

from PySide6.QtWidgets import QLabel

HELP_TEXT = {
    "SLA": "Service Level Agreement — % of contacts answered within the target wait time.",
    "ASA": "Average Speed of Answer — mean wait time before an agent responds.",
    "Shrinkage": "Time agents are paid but not available (breaks, training, meetings).",
    "Occupancy": "% of logged-in time agents spend handling contacts.",
    "Erlang C": "Queue model with infinite patience — abandonment is always 0%.",
    "Erlang A": "Queue model that includes caller abandonment based on patience.",
    "Erlang B": "Blocking model for trunk/resource capacity (no queue).",
    "Patience": "Average time a caller waits before hanging up.",
    "AHT": "Average Handle Time — mean duration of a contact including wrap-up.",
}


def help_label(text: str, term: str | None = None) -> QLabel:
    label = QLabel(text)
    if term and term in HELP_TEXT:
        label.setToolTip(HELP_TEXT[term])
        label.setStyleSheet("border-bottom: 1px dotted #3498db;")
    return label


def approximation_badge(text: str) -> QLabel:
    badge = QLabel(f"⚠ {text}")
    badge.setStyleSheet(
        "background: #fff3cd; color: #856404; padding: 6px 12px; "
        "border-radius: 4px; font-size: 12px;"
    )
    badge.setWordWrap(True)
    return badge

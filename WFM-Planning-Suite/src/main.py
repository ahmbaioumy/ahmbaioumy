#!/usr/bin/env python3
"""WFM Planning Suite — application entry point."""

from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from ui.main_window import MainWindow
from wfm_io.state import PipelineState


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("WFM Planning Suite")
    app.setOrganizationName("WFM")

    state = PipelineState()
    saved = state.load_all()
    if saved:
        print(f"Recovered pipeline state from {state.state_file}")

    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())

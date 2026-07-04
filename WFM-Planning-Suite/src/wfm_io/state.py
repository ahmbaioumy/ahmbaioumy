"""Pipeline state persistence for crash recovery."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


class PipelineState:
    def __init__(self, state_dir: str | Path | None = None):
        self.state_dir = Path(state_dir or Path.home() / ".wfm-planning-suite")
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.state_dir / "pipeline_state.json"

    def save(self, stage: str, data: dict[str, Any]) -> None:
        existing = self.load_all()
        existing[stage] = data
        existing["_last_saved"] = datetime.now().isoformat()
        self.state_file.write_text(json.dumps(existing, default=str, indent=2))

    def load_all(self) -> dict[str, Any]:
        if not self.state_file.exists():
            return {}
        return json.loads(self.state_file.read_text())

    def load_stage(self, stage: str) -> dict[str, Any] | None:
        return self.load_all().get(stage)

    def clear(self) -> None:
        if self.state_file.exists():
            self.state_file.unlink()

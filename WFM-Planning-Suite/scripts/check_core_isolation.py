#!/usr/bin/env python3
"""Ensure core/ modules do not import PySide6."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FORBIDDEN = re.compile(r"\b(import|from)\s+PySide6\b")

CORE = Path(__file__).resolve().parent.parent / "src" / "core"
violations: list[str] = []

for path in CORE.rglob("*.py"):
    for i, line in enumerate(path.read_text().splitlines(), 1):
        if FORBIDDEN.search(line):
            violations.append(f"{path}:{i}: {line.strip()}")

if violations:
    print("CORE ISOLATION VIOLATIONS:")
    for v in violations:
        print(v)
    sys.exit(1)

print("Core isolation check passed — no PySide6 imports in core/")

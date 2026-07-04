#!/usr/bin/env python3
"""Scan production code for forbidden networking imports."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FORBIDDEN = re.compile(
    r"\b(import|from)\s+(urllib|requests|httpx|aiohttp|socket|ftplib|smtplib|http\.client)\b"
)

SRC = Path(__file__).resolve().parent.parent / "src"
violations: list[str] = []

for path in SRC.rglob("*.py"):
    if "tests" in path.parts:
        continue
    text = path.read_text()
    for i, line in enumerate(text.splitlines(), 1):
        if FORBIDDEN.search(line) and not line.strip().startswith("#"):
            violations.append(f"{path}:{i}: {line.strip()}")

if violations:
    print("OFFLINE VIOLATIONS FOUND:")
    for v in violations:
        print(v)
    sys.exit(1)

print("Offline check passed — no networking imports in src/")

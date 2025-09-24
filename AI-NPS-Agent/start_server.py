#!/usr/bin/env python3
"""
Simple server startup script for testing
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.main import app
import uvicorn

if __name__ == "__main__":
    print("Starting Azure AI Chat NPS Assistant server...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
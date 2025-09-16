from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfo(BaseModel):
    username: str
    role: str = "agent"


class LoginRequest(BaseModel):
    username: str
    password: str


class PredictRequest(BaseModel):
    transcript: str
    nps_history: Optional[List[int]] = None


class PredictResponse(BaseModel):
    label: str
    prob_detractor: float
    sentiment: float
    explanation: str


class ChatMessageIn(BaseModel):
    sender: str = Field(pattern="^(agent|customer|system)$")
    content: str


class ChatMessageOut(BaseModel):
    id: int
    session_id: str
    sender: str
    content: str
    timestamp: datetime
    sentiment_score: float | None = None
    detractor_risk: float | None = None


class ManagerSummary(BaseModel):
    totals: dict
    by_day: list
    recent_chats: list


from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    customer_id = Column(String, nullable=True)
    agent_id = Column(String, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), index=True, nullable=False)
    sender = Column(String, nullable=False)  # 'agent' | 'customer' | 'system'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    sentiment_score = Column(Float, nullable=True)
    detractor_risk = Column(Float, nullable=True)

    session = relationship("ChatSession", back_populates="messages")


class NPSRecord(Base):
    __tablename__ = "nps_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date_time = Column(DateTime, default=datetime.utcnow, index=True)
    chat_id = Column(String, index=True)
    transcript = Column(Text, nullable=True)
    nps_score = Column(Integer, index=True)
    reason_cwc = Column(String, nullable=True)
    m1 = Column(String, nullable=True)
    m2 = Column(String, nullable=True)
    m3 = Column(String, nullable=True)
    segment = Column(String, nullable=True)
    lang = Column(String, nullable=True)
    agent_login = Column(String, nullable=True)
    agent_site = Column(String, nullable=True)


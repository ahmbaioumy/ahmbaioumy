from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Float, UniqueConstraint
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


class PrayerSettings(Base):
    __tablename__ = "prayer_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True, unique=True, nullable=False)
    method = Column(String, nullable=False, default="auto")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone_offset_minutes = Column(Integer, default=0)
    reminder_interval_minutes = Column(Integer, default=10)
    critical_before_next_minutes = Column(Integer, default=15)
    asr_shadow_factor = Column(Integer, default=1)
    fajr_angle = Column(Float, default=18.0)
    isha_angle = Column(Float, default=17.0)
    manual_fajr = Column(String, nullable=True)
    manual_dhuhr = Column(String, nullable=True)
    manual_asr = Column(String, nullable=True)
    manual_maghrib = Column(String, nullable=True)
    manual_isha = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PrayerEntry(Base):
    __tablename__ = "prayer_entries"
    __table_args__ = (UniqueConstraint("user_id", "date", "prayer_name", name="uq_prayer_entry"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=False)
    date = Column(String, index=True, nullable=False)
    prayer_name = Column(String, index=True, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="pending", nullable=False)
    bucket = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DevotionEntry(Base):
    __tablename__ = "devotion_entries"
    __table_args__ = (UniqueConstraint("user_id", "date", "devotion_key", name="uq_devotion_entry"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=False)
    date = Column(String, index=True, nullable=False)
    devotion_key = Column(String, index=True, nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


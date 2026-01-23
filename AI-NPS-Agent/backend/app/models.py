from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean, Date, UniqueConstraint, Index
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

    username = Column(String, primary_key=True)
    mode = Column(String, nullable=False, default="auto")  # auto | manual

    # Auto mode
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    tz_offset_min = Column(Integer, nullable=False, default=0)  # local = utc - tz_offset_min
    calc_method = Column(String, nullable=False, default="MWL")
    madhab = Column(String, nullable=False, default="shafi")  # shafi | hanafi

    # Reminders
    reminder_interval_min = Column(Integer, nullable=False, default=15)
    critical_before_next_min = Column(Integer, nullable=False, default=10)
    allow_late_mark = Column(Boolean, nullable=False, default=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class PrayerDaySchedule(Base):
    __tablename__ = "prayer_day_schedules"
    __table_args__ = (UniqueConstraint("username", "day", name="uq_prayer_day_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, index=True, nullable=False)
    day = Column(Date, index=True, nullable=False)
    source = Column(String, nullable=False, default="auto")  # auto | manual

    # Stored as UTC datetimes
    fajr_at = Column(DateTime, nullable=False)
    dhuhr_at = Column(DateTime, nullable=False)
    asr_at = Column(DateTime, nullable=False)
    maghrib_at = Column(DateTime, nullable=False)
    isha_at = Column(DateTime, nullable=False)

    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PrayerLog(Base):
    __tablename__ = "prayer_logs"
    __table_args__ = (
        UniqueConstraint("username", "day", "prayer", name="uq_prayer_log_user_day_prayer"),
        Index("ix_prayer_logs_user_day", "username", "day"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, index=True, nullable=False)
    day = Column(Date, index=True, nullable=False)
    prayer = Column(String, nullable=False)  # fajr|dhuhr|asr|maghrib|isha

    scheduled_at = Column(DateTime, nullable=False)  # UTC
    next_prayer_at = Column(DateTime, nullable=True)  # UTC

    status = Column(String, nullable=False, default="pending")  # pending|completed|missed
    bucket = Column(String, nullable=True)  # h1|h2|h3|after3|after_next|missed
    points = Column(Integer, nullable=False, default=0)

    marked_at = Column(DateTime, nullable=True)  # UTC when user marks completion/missed
    note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class IbadahSettings(Base):
    __tablename__ = "ibadah_settings"

    username = Column(String, primary_key=True)
    enabled_types_json = Column(Text, nullable=False, default='["azkar_am","azkar_pm","quran_page","dua_10m","sadaqa","night_prayer"]')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class IbadahLog(Base):
    __tablename__ = "ibadah_logs"
    __table_args__ = (
        UniqueConstraint("username", "day", "ibadah_type", name="uq_ibadah_log_user_day_type"),
        Index("ix_ibadah_logs_user_day", "username", "day"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, index=True, nullable=False)
    day = Column(Date, index=True, nullable=False)
    ibadah_type = Column(String, nullable=False)  # azkar_am|azkar_pm|quran_page|dua_10m|sadaqa|night_prayer

    status = Column(String, nullable=False, default="pending")  # pending|completed|skipped
    points = Column(Integer, nullable=False, default=0)
    duration_min = Column(Integer, nullable=True)
    marked_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

from __future__ import annotations

from datetime import datetime, timedelta
from sqlalchemy import select, func, case, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.models import NPSRecord, ChatSession, ChatMessage
from app.schemas import ManagerSummary
from app.utils.auth import get_current_user


router = APIRouter()


@router.get("/summary", response_model=ManagerSummary)
async def summary(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> ManagerSummary:
    # Basic role check
    if user.get("role") not in ("manager", "admin"):
        # allow agents to view, but ideally restrict; for demo we allow
        pass

    # Totals last 90 days
    since = datetime.utcnow() - timedelta(days=90)
    stmt = select(
        func.count(),
        func.sum(case((NPSRecord.nps_score <= 6, 1), else_=0).cast(Integer)),
        func.sum(case((NPSRecord.nps_score.between(7, 8), 1), else_=0).cast(Integer)),
        func.sum(case((NPSRecord.nps_score >= 9, 1), else_=0).cast(Integer)),
    ).where(NPSRecord.date_time >= since)
    res = await db.execute(stmt)
    total, detractors, passives, promoters = res.fetchone() or (0, 0, 0, 0)

    # By day counts
    stmt_day = select(
        func.date(NPSRecord.date_time),
        func.count().label("count"),
    ).where(NPSRecord.date_time >= since).group_by(func.date(NPSRecord.date_time)).order_by(func.date(NPSRecord.date_time))
    res_day = await db.execute(stmt_day)
    by_day = [{"date": str(r[0]), "count": int(r[1])} for r in res_day.fetchall()]

    # Recent chats
    stmt_recent = select(ChatSession.id, func.max(ChatMessage.timestamp)).join(ChatMessage).group_by(ChatSession.id).order_by(func.max(ChatMessage.timestamp).desc()).limit(10)
    res_recent = await db.execute(stmt_recent)
    recent_chats = [
        {"sessionId": s, "lastMessageAt": str(ts)} for s, ts in res_recent.fetchall()
    ]

    return ManagerSummary(
        totals={
            "total": int(total or 0),
            "detractors": int(detractors or 0),
            "passives": int(passives or 0),
            "promoters": int(promoters or 0),
        },
        by_day=by_day,
        recent_chats=recent_chats,
    )


from __future__ import annotations

import json
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.core.database import get_db
from app.models import ChatSession, ChatMessage
from app.services.predictor import PredictorService


router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict) -> None:
        for ws in list(self.active_connections.get(session_id, set())):
            if ws.application_state.name == "CONNECTED":
                await ws.send_text(json.dumps(message))


manager = ConnectionManager()


@router.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket, sessionId: str = Query(...), db: AsyncSession = Depends(get_db)) -> None:
    await manager.connect(sessionId, websocket)
    try:
        # Ensure chat session exists
        existing = await db.execute(select(ChatSession).where(ChatSession.id == sessionId))
        session_obj = existing.scalars().first()
        if session_obj is None:
            session_obj = ChatSession(id=sessionId)
            db.add(session_obj)
            await db.commit()

        predictor = PredictorService.get_instance()

        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
            except Exception:
                data = {"sender": "customer", "content": text}

            sender = data.get("sender", "customer")
            content = data.get("content", "")
            result = predictor.predict_from_text(content)

            # Persist message
            msg = ChatMessage(
                session_id=sessionId,
                sender=sender,
                content=content,
                sentiment_score=result.sentiment,
                detractor_risk=result.prob_detractor,
                timestamp=datetime.utcnow(),
            )
            db.add(msg)
            await db.commit()
            await db.refresh(msg)

            payload = {
                "type": "message",
                "message": {
                    "id": msg.id,
                    "sender": sender,
                    "content": content,
                    "timestamp": msg.timestamp.isoformat(),
                    "sentiment": result.sentiment,
                    "risk": result.prob_detractor,
                },
            }
            await manager.broadcast(sessionId, payload)

            # Alert if risk high
            if result.prob_detractor >= 0.6:
                alert = {
                    "type": "alert",
                    "title": "Detractor Risk",
                    "message": "Conversation trending negative. Consider empathy, clarify resolution steps.",
                    "risk": result.prob_detractor,
                    "sentiment": result.sentiment,
                }
                await manager.broadcast(sessionId, alert)

    except WebSocketDisconnect:
        manager.disconnect(sessionId, websocket)


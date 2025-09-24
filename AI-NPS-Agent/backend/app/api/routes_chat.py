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


def _generate_ai_recommendation(customer_message: str, prediction_result) -> dict:
    """Generate AI recommendation based on customer message and prediction"""
    import uuid
    from datetime import datetime
    
    # Simple rule-based recommendation system
    # In production, this would use Azure OpenAI or a more sophisticated model
    
    if "angry" in customer_message.lower() or "frustrated" in customer_message.lower():
        suggested_response = "I understand your frustration, and I'm here to help resolve this issue for you. Let me take a closer look at your situation and provide you with a solution."
        reasoning = "Customer appears angry/frustrated. Recommend empathetic acknowledgment and proactive problem-solving approach."
    elif "refund" in customer_message.lower() or "money" in customer_message.lower():
        suggested_response = "I understand your concern about the refund. Let me review your account and explain the refund process clearly. I'll make sure you understand all your options."
        reasoning = "Customer mentions refund/money. Recommend clear explanation of refund process and account review."
    elif "slow" in customer_message.lower() or "delay" in customer_message.lower():
        suggested_response = "I apologize for the delay you've experienced. Let me check the status of your request and provide you with an updated timeline. I'll also see if there are any ways to expedite this for you."
        reasoning = "Customer mentions delays. Recommend apology, status check, and expedited resolution options."
    elif "broken" in customer_message.lower() or "not working" in customer_message.lower():
        suggested_response = "I'm sorry to hear that you're experiencing issues with our product/service. Let me troubleshoot this with you step by step to identify the root cause and get it working properly."
        reasoning = "Customer reports product/service issues. Recommend systematic troubleshooting approach."
    else:
        suggested_response = "I understand your concern, and I want to make sure we address this properly. Let me gather some additional information from you so I can provide the best possible solution."
        reasoning = "General customer concern detected. Recommend information gathering and solution-focused approach."
    
    return {
        "type": "ai_recommendation",
        "id": str(uuid.uuid4()),
        "suggestedResponse": suggested_response,
        "risk": prediction_result.prob_detractor,
        "sentiment": prediction_result.sentiment,
        "reasoning": reasoning,
        "timestamp": datetime.utcnow().isoformat()
    }


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

            # Handle alternative recommendation request
            if data.get("type") == "request_alternative":
                # Generate alternative recommendation
                alternative_content = "I'm still not satisfied with the previous response. Can you help me better?"
                alt_result = predictor.predict_from_text(alternative_content)
                recommendation = _generate_ai_recommendation(alternative_content, alt_result)
                recommendation["suggestedResponse"] = "I hear your concern, and I want to make sure we get this right for you. Let me approach this differently and provide you with a more personalized solution."
                recommendation["reasoning"] = "Customer requested alternative approach. Recommend different solution strategy with personalized approach."
                await manager.broadcast(sessionId, recommendation)
                continue

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
                
                # Generate AI recommendation if customer message and high risk
                if sender == "customer" and result.prob_detractor >= 0.7:
                    recommendation = _generate_ai_recommendation(content, result)
                    await manager.broadcast(sessionId, recommendation)

    except WebSocketDisconnect:
        manager.disconnect(sessionId, websocket)


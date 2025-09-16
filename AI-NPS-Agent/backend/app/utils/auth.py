from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.core.config import settings


security = HTTPBearer(auto_error=False)


def create_access_token(subject: str, role: str = "agent", expires_minutes: int = 60) -> str:
    to_encode = {
        "sub": subject,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
        "iss": "ai-nps-assistant",
    }
    return jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return {"username": payload.get("sub"), "role": payload.get("role", "agent")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")


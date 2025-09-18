from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends

from app.core.config import settings
from app.schemas import LoginRequest, TokenResponse, UserInfo
from app.utils.auth import create_access_token, get_current_user


router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    # Mock authentication locally; for azureb2c, exchange token server-side
    if settings.auth_provider == "mock":
        if not payload.username or not payload.password:
            raise HTTPException(status_code=400, detail="Missing credentials")
        role = "manager" if payload.username.endswith("@manager") else "agent"
        token = create_access_token(subject=payload.username, role=role)
        return TokenResponse(access_token=token)
    else:
        # Placeholder for Azure AD B2C code path
        # In production, you'd verify id_token or auth code here
        token = create_access_token(subject=payload.username)
        return TokenResponse(access_token=token)


@router.get("/me", response_model=UserInfo)
async def me(user=Depends(get_current_user)) -> UserInfo:
    return UserInfo(username=user["username"], role=user.get("role", "agent"))


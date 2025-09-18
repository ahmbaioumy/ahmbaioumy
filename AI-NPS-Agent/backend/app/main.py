from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState
from app.core.config import settings
from app.core.database import init_engine_and_session, create_all_tables
from app.api.routes_chat import router as chat_router
from app.api.routes_predict import router as predict_router
from app.api.routes_auth import router as auth_router
from app.api.routes_manager import router as manager_router
from app.services.predictor import PredictorService
import uvicorn


app = FastAPI(title="AI NPS Assistant", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    # Initialize DB
    init_engine_and_session()
    await create_all_tables()
    # Warm up predictor (train or load)
    PredictorService.get_instance().ensure_model_ready()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(predict_router, prefix="/predict", tags=["predict"])
app.include_router(manager_router, prefix="/manager", tags=["manager"])
app.include_router(chat_router, tags=["chat"])  # contains /ws/chat


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas import PredictRequest, PredictResponse
from app.services.predictor import PredictorService
from app.utils.auth import get_current_user


router = APIRouter()


@router.post("/", response_model=PredictResponse)
async def predict(payload: PredictRequest, user=Depends(get_current_user)) -> PredictResponse:
    predictor = PredictorService.get_instance()
    result = predictor.predict_from_text(payload.transcript)
    return PredictResponse(
        label=result.label,
        prob_detractor=result.prob_detractor,
        sentiment=result.sentiment,
        explanation=result.explanation,
    )


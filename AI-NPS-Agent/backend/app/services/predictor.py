from __future__ import annotations

import os
import joblib
import pandas as pd
from dataclasses import dataclass
from typing import Optional
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from app.core.config import settings


@dataclass
class PredictionResult:
    label: str
    prob_detractor: float
    sentiment: float
    explanation: str


class PredictorService:
    _instance: Optional["PredictorService"] = None

    def __init__(self) -> None:
        self.model_path = settings.model_path
        self.model: Optional[Pipeline] = None
        self.sentiment = SentimentIntensityAnalyzer()

    @classmethod
    def get_instance(cls) -> "PredictorService":
        if cls._instance is None:
            cls._instance = PredictorService()
        return cls._instance

    def ensure_model_ready(self) -> None:
        if self.model is None:
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
            else:
                self._train_minimal_model()

    def _train_minimal_model(self) -> None:
        # Fallback small training from mock CSV
        data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ai/data/mock_nps_chats.csv"))
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        if not os.path.exists(data_path):
            # Train a trivial model on tiny synthetic data
            texts = [
                "I am very unhappy with the service, this is terrible",
                "This is okay, could be better",
                "Absolutely fantastic experience, thank you",
            ]
            labels = [1, 0, 0]  # 1 = detractor
            pipeline = Pipeline(
                steps=[
                    ("tfidf", TfidfVectorizer(max_features=1000)),
                    ("clf", LogisticRegression(max_iter=500)),
                ]
            )
            pipeline.fit(texts, labels)
            self.model = pipeline
            joblib.dump(pipeline, self.model_path)
            return

        df = pd.read_csv(data_path)
        df = df.dropna(subset=["Chat_Transcript", "NPS score"])
        def label_from_score(score: int) -> int:
            if score <= 6:
                return 1
            if score <= 8:
                return 0
            return 0
        y = df["NPS score"].astype(int).apply(label_from_score)
        X = df["Chat_Transcript"].astype(str).tolist()
        pipeline = Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1,2))),
                ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        )
        pipeline.fit(X, y)
        self.model = pipeline
        joblib.dump(pipeline, self.model_path)

    def predict_from_text(self, transcript: str) -> PredictionResult:
        self.ensure_model_ready()
        assert self.model is not None
        sentiment_score = self.sentiment.polarity_scores(transcript)["compound"]
        proba = self.model.predict_proba([transcript])[0]
        # Assume class 1 is detractor
        prob_detractor = float(proba[1]) if len(proba) > 1 else float(proba[0])
        label = "detractor" if prob_detractor >= 0.5 else "non-detractor"
        explanation = f"Model probability of detractor: {prob_detractor:.2f}; sentiment {sentiment_score:.2f}"
        return PredictionResult(label=label, prob_detractor=prob_detractor, sentiment=sentiment_score, explanation=explanation)


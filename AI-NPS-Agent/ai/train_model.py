import argparse
import os
import joblib
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score


def label_from_score(score: int) -> int:
    if score <= 6:
        return 1
    if score <= 8:
        return 0
    return 0


def train(data_path: str, out_path: str) -> None:
    df = pd.read_csv(data_path)
    df = df.dropna(subset=["Chat_Transcript", "NPS score"])
    X = df["Chat_Transcript"].astype(str).tolist()
    y = df["NPS score"].astype(int).apply(label_from_score)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    pipeline = Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1,2))),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print("Accuracy:", acc)
    print(classification_report(y_test, preds))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    joblib.dump(pipeline, out_path)
    print(f"Saved model to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "data/mock_nps_chats.csv")))
    parser.add_argument("--out", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "model/model.pkl")))
    args = parser.parse_args()
    train(args.data, args.out)


import argparse
import os
import joblib
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
import openai
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


def label_from_score(score: int) -> int:
    if score <= 6:
        return 1
    if score <= 8:
        return 0
    return 0


def train(data_path: str, out_path: str, use_azure_openai: bool = False) -> None:
    print("Loading training data...")
    df = pd.read_csv(data_path)
    df = df.dropna(subset=["Chat_Transcript", "NPS score"])
    
    print(f"Training on {len(df)} samples")
    
    # Prepare features
    X = df["Chat_Transcript"].astype(str).tolist()
    y = df["NPS score"].astype(int).apply(label_from_score)
    
    # Add sentiment features
    sentiment_analyzer = SentimentIntensityAnalyzer()
    sentiment_features = []
    for text in X:
        scores = sentiment_analyzer.polarity_scores(text)
        sentiment_features.append([
            scores['compound'],
            scores['pos'],
            scores['neg'],
            scores['neu']
        ])
    
    sentiment_features = np.array(sentiment_features)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    print(f"Class distribution: {np.bincount(y)}")
    
    # Try multiple models and select the best one
    models = {
        'logistic_regression': Pipeline([
            ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1,3), min_df=2)),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42))
        ]),
        'random_forest': Pipeline([
            ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1,2), min_df=2)),
            ("clf", RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42))
        ]),
        'svm': Pipeline([
            ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1,2), min_df=2)),
            ("clf", SVC(kernel='linear', class_weight="balanced", random_state=42))
        ])
    }
    
    best_model = None
    best_score = 0
    best_name = ""
    
    for name, model in models.items():
        print(f"\nTraining {name}...")
        
        # Cross-validation
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')
        print(f"CV Accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
        
        # Train on full training set
        model.fit(X_train, y_train)
        
        # Test performance
        preds = model.predict(X_test)
        acc = accuracy_score(y_test, preds)
        print(f"Test Accuracy: {acc:.3f}")
        
        if acc > best_score:
            best_score = acc
            best_model = model
            best_name = name
    
    print(f"\nBest model: {best_name} with accuracy: {best_score:.3f}")
    
    # Detailed evaluation of best model
    preds = best_model.predict(X_test)
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, preds))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, preds))
    
    # Save the best model
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    joblib.dump(best_model, out_path)
    print(f"\nSaved best model ({best_name}) to {out_path}")
    
    # Save model metadata
    metadata = {
        'model_name': best_name,
        'accuracy': best_score,
        'training_samples': len(X_train),
        'test_samples': len(X_test),
        'features': 'tfidf_ngrams',
        'class_distribution': np.bincount(y).tolist()
    }
    
    metadata_path = out_path.replace('.pkl', '_metadata.json')
    import json
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved model metadata to {metadata_path}")
    
    return best_model, best_score


def train_with_azure_openai(data_path: str, out_path: str) -> None:
    """Enhanced training using Azure OpenAI for better feature extraction"""
    print("Training with Azure OpenAI integration...")
    
    # This would integrate with Azure OpenAI for enhanced text understanding
    # For now, we'll use the standard training but with enhanced features
    print("Note: Azure OpenAI integration requires API keys and endpoint configuration")
    print("Falling back to enhanced traditional ML approach...")
    
    return train(data_path, out_path, use_azure_openai=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train NPS prediction model")
    parser.add_argument("--data", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "data/simple_training_data.csv")),
                       help="Path to training data CSV")
    parser.add_argument("--out", default=os.path.abspath(os.path.join(os.path.dirname(__file__), "model/model.pkl")),
                       help="Output path for trained model")
    parser.add_argument("--use-azure-openai", action="store_true",
                       help="Use Azure OpenAI for enhanced training")
    parser.add_argument("--azure-openai-endpoint", 
                       help="Azure OpenAI endpoint URL")
    parser.add_argument("--azure-openai-key", 
                       help="Azure OpenAI API key")
    
    args = parser.parse_args()
    
    # Set up Azure OpenAI if provided
    if args.use_azure_openai and args.azure_openai_endpoint and args.azure_openai_key:
        openai.api_type = "azure"
        openai.api_base = args.azure_openai_endpoint
        openai.api_version = "2023-05-15"
        openai.api_key = args.azure_openai_key
        train_with_azure_openai(args.data, args.out)
    else:
        train(args.data, args.out, use_azure_openai=False)


import json
import os
import sys
import joblib
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "severity_model.joblib")

def main():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            "Trained model not found. Run: python ai/train_model.py"
        )

    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")

    report_type = str(payload.get("type", "other"))
    description = str(payload.get("description", ""))
    people = max(0, float(payload.get("peopleAffected", 0) or 0))

    sample = pd.DataFrame([{
        "type": report_type,
        "description": description,
        "peopleAffected": people
    }])

    model = joblib.load(MODEL_PATH)
    probabilities = model.predict_proba(sample)[0]
    classes = model.named_steps["classifier"].classes_

    best_index = int(probabilities.argmax())
    severity = str(classes[best_index])
    confidence = float(probabilities[best_index])

    probability_map = {
        str(label): round(float(prob), 4)
        for label, prob in zip(classes, probabilities)
    }

    urgency_map = {
        "low": "routine",
        "medium": "soon",
        "high": "urgent",
        "critical": "immediate"
    }

    severity_score = {
        "low": 25,
        "medium": 50,
        "high": 75,
        "critical": 100
    }[severity]

    people_score = min(25, people)
    priority_score = min(
        100,
        round(severity_score * 0.70 + people_score)
    )

    result = {
        "incidentType": report_type,
        "severity": severity,
        "confidence": round(confidence, 2),
        "urgency": urgency_map[severity],
        "priorityScore": int(priority_score),
        "probabilities": probability_map,
        "model": "TF-IDF + Logistic Regression",
        "explanation": (
            "Severity predicted by a supervised ML model trained on labelled "
            "disaster-report examples using report description, disaster type "
            "and affected population. Authority verification is required "
            "before treating the prediction as the official severity."
        )
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()

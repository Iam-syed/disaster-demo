import os
import pandas as pd
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "training_data.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "severity_model.joblib")

df = pd.read_csv(DATA_PATH)

X = df[["type", "description", "peopleAffected"]]
y = df["severity"]

preprocessor = ColumnTransformer(
    transformers=[
        ("description", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            sublinear_tf=True
        ), "description"),
        ("type", OneHotEncoder(handle_unknown="ignore"), ["type"]),
        ("people", StandardScaler(), ["peopleAffected"])
    ]
)

model = Pipeline([
    ("features", preprocessor),
    ("classifier", LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=42
    ))
])

model.fit(X, y)

os.makedirs(MODEL_DIR, exist_ok=True)
joblib.dump(model, MODEL_PATH)

print("Severity model trained successfully.")
print(f"Training samples: {len(df)}")
print(f"Classes: {', '.join(sorted(y.unique()))}")
print(f"Saved model: {MODEL_PATH}")

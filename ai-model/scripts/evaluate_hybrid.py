from pathlib import Path

import joblib
import pandas as pd

from sklearn.metrics import (
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
)


MODEL_PATH = Path("models/random_forest_v1.joblib")
VALIDATION_PATH = Path("data/validation_features_clean.csv")

RF_THRESHOLD = 0.190
ACCEL_THRESHOLD = 2.0


print("Loading model and validation data...")

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
features = bundle["features"]

df = pd.read_csv(VALIDATION_PATH)

X = df[features]

y_true = (df["label"] == 0).astype(int)

probabilities = model.predict_proba(X)[:, 1]


rf_prediction = (
    probabilities >= RF_THRESHOLD
).astype(int)

rule_prediction = (
    df["accel_max"] >= ACCEL_THRESHOLD
).astype(int)

hybrid_prediction = (
    (rf_prediction == 1)
    | (rule_prediction == 1)
).astype(int)


def evaluate(name, prediction):

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        prediction,
        labels=[0, 1],
    ).ravel()

    precision = precision_score(
        y_true,
        prediction,
        zero_division=0,
    )

    recall = recall_score(
        y_true,
        prediction,
        zero_division=0,
    )

    f1 = f1_score(
        y_true,
        prediction,
        zero_division=0,
    )

    print("\n===================================")
    print(name)
    print("===================================")

    print(f"True Negatives : {tn:,}")
    print(f"False Positives: {fp:,}")
    print(f"False Negatives: {fn:,}")
    print(f"True Positives : {tp:,}")

    print()
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1 Score : {f1:.4f}")


evaluate(
    "RANDOM FOREST @ 0.190",
    rf_prediction,
)

evaluate(
    "2.0 g RULE",
    rule_prediction,
)

evaluate(
    "HYBRID: RF >= 0.190 OR ACCEL >= 2.0 g",
    hybrid_prediction,
)


# -------------------------------------------------
# Breakdown of hybrid false positives
# -------------------------------------------------

df["hybrid_prediction"] = hybrid_prediction
df["true_crash"] = y_true

hybrid_fp = df[
    (df["true_crash"] == 0)
    & (df["hybrid_prediction"] == 1)
]

print("\n===================================")
print("HYBRID FALSE POSITIVES BY CLASS")
print("===================================")

print(
    hybrid_fp["class"]
    .value_counts()
)
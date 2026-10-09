from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    confusion_matrix,
    precision_score,
    recall_score,
    f1_score,
)


MODEL_PATH = Path("models/random_forest_v1.joblib")
VALIDATION_PATH = Path("data/validation_features_clean.csv")


print("Loading model and validation data...")

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
features = bundle["features"]

df = pd.read_csv(VALIDATION_PATH)

X = df[features]

# Crash = 1
# Near Miss / Normal = 0
y_true = (df["label"] == 0).astype(int)


print("Generating crash probabilities...")

probabilities = model.predict_proba(X)[:, 1]


# Compare thresholds from 0.10 to 0.30
thresholds = np.round(
    np.arange(
        0.10,
        0.301,
        0.005,
    ),
    3,
)


rows = []

for threshold in thresholds:

    y_pred = (
        probabilities >= threshold
    ).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        y_pred,
        labels=[0, 1],
    ).ravel()

    precision = precision_score(
        y_true,
        y_pred,
        zero_division=0,
    )

    recall = recall_score(
        y_true,
        y_pred,
        zero_division=0,
    )

    f1 = f1_score(
        y_true,
        y_pred,
        zero_division=0,
    )

    rows.append({
        "threshold": threshold,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_positives": fp,
        "false_negatives": fn,
        "true_positives": tp,
        "true_negatives": tn,
    })


results = pd.DataFrame(rows)


print("\n===================================")
print("THRESHOLD COMPARISON")
print("===================================")

print(
    results.to_string(
        index=False,
        formatters={
            "threshold": "{:.3f}".format,
            "precision": "{:.4f}".format,
            "recall": "{:.4f}".format,
            "f1": "{:.4f}".format,
        },
    )
)


# -------------------------------------------------
# Find threshold with best F1
# -------------------------------------------------

best_f1 = results.loc[
    results["f1"].idxmax()
]


print("\n===================================")
print("BEST F1 THRESHOLD")
print("===================================")

print(best_f1.to_string())


# -------------------------------------------------
# Find highest precision while maintaining
# at least the recall achieved by the 2.0 g rule
# -------------------------------------------------

TARGET_RECALL = 4071 / 4226

high_recall = results[
    results["recall"] >= TARGET_RECALL
]


print("\n===================================")
print(
    f"BEST THRESHOLD WITH RECALL >= "
    f"{TARGET_RECALL:.4f}"
)
print("===================================")

if len(high_recall) > 0:

    best_high_recall = high_recall.loc[
        high_recall["precision"].idxmax()
    ]

    print(best_high_recall.to_string())

else:
    print(
        f"No tested threshold achieved "
        f"{TARGET_RECALL:.4f} recall."
    )
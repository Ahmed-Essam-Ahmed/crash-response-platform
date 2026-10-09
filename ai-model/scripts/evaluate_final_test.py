from pathlib import Path

import joblib
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


MODEL_PATH = Path(
    "models/random_forest_v1_final.joblib"
)

TEST_PATH = Path(
    "data/test_features_clean.csv"
)


print("Loading frozen V1 model...")

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
features = bundle["features"]
threshold = bundle["threshold"]


print(f"Frozen threshold: {threshold:.3f}")


print("\nLoading clean test features...")

df = pd.read_csv(TEST_PATH)

print(f"Test events: {len(df):,}")


# -------------------------------------------------
# Prepare data
# -------------------------------------------------

X_test = df[features]

# Crash = 1
# Near Miss / Normal Driving = 0
y_test = (df["label"] == 0).astype(int)


if X_test.isna().any().any():
    raise ValueError(
        "NaN found in test features."
    )


# -------------------------------------------------
# Random Forest predictions
# -------------------------------------------------

print("\nGenerating final predictions...")

probabilities = model.predict_proba(
    X_test
)[:, 1]

predictions = (
    probabilities >= threshold
).astype(int)


tn, fp, fn, tp = confusion_matrix(
    y_test,
    predictions,
    labels=[0, 1],
).ravel()


accuracy = accuracy_score(
    y_test,
    predictions,
)

precision = precision_score(
    y_test,
    predictions,
    zero_division=0,
)

recall = recall_score(
    y_test,
    predictions,
    zero_division=0,
)

f1 = f1_score(
    y_test,
    predictions,
    zero_division=0,
)

roc_auc = roc_auc_score(
    y_test,
    probabilities,
)

pr_auc = average_precision_score(
    y_test,
    probabilities,
)

specificity = tn / (tn + fp)

false_positive_rate = fp / (fp + tn)


print("\n===================================")
print("FINAL TEST RESULTS — RF V1")
print("===================================")

print(f"Threshold       : {threshold:.3f}")

print("\nConfusion Matrix")
print("-----------------------------------")
print(f"True Negatives : {tn:,}")
print(f"False Positives: {fp:,}")
print(f"False Negatives: {fn:,}")
print(f"True Positives : {tp:,}")

print("\nMetrics")
print("-----------------------------------")
print(f"Accuracy        : {accuracy:.4f}")
print(f"Precision       : {precision:.4f}")
print(f"Recall          : {recall:.4f}")
print(f"F1 Score        : {f1:.4f}")
print(f"Specificity     : {specificity:.4f}")
print(f"False Pos Rate  : {false_positive_rate:.4f}")
print(f"ROC-AUC         : {roc_auc:.4f}")
print(f"PR-AUC          : {pr_auc:.4f}")


# -------------------------------------------------
# Frozen 2.0 g baseline
# -------------------------------------------------

rule_predictions = (
    df["accel_max"] >= 2.0
).astype(int)

rule_tn, rule_fp, rule_fn, rule_tp = (
    confusion_matrix(
        y_test,
        rule_predictions,
        labels=[0, 1],
    ).ravel()
)

rule_accuracy = accuracy_score(
    y_test,
    rule_predictions,
)

rule_precision = precision_score(
    y_test,
    rule_predictions,
    zero_division=0,
)

rule_recall = recall_score(
    y_test,
    rule_predictions,
    zero_division=0,
)

rule_f1 = f1_score(
    y_test,
    rule_predictions,
    zero_division=0,
)


print("\n===================================")
print("FINAL TEST RESULTS — 2.0 g RULE")
print("===================================")

print(f"True Negatives : {rule_tn:,}")
print(f"False Positives: {rule_fp:,}")
print(f"False Negatives: {rule_fn:,}")
print(f"True Positives : {rule_tp:,}")

print()
print(f"Accuracy : {rule_accuracy:.4f}")
print(f"Precision: {rule_precision:.4f}")
print(f"Recall   : {rule_recall:.4f}")
print(f"F1 Score : {rule_f1:.4f}")


# -------------------------------------------------
# False-positive breakdown
# -------------------------------------------------

result_df = df.copy()

result_df["crash_probability"] = probabilities
result_df["predicted_crash"] = predictions
result_df["true_crash"] = y_test


false_positives = result_df[
    (result_df["true_crash"] == 0)
    & (result_df["predicted_crash"] == 1)
]


print("\n===================================")
print("RF FALSE POSITIVES BY TRUE CLASS")
print("===================================")

print(
    false_positives["class"]
    .value_counts()
)


print("\n===================================")
print("FINAL V1 EVALUATION COMPLETE")
print("===================================")
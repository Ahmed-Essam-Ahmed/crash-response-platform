from pathlib import Path

import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


TRAIN_PATH = Path("data/train_features_clean.csv")
VALIDATION_PATH = Path("data/validation_features_clean.csv")

MODEL_PATH = Path("models/random_forest_v1.joblib")


FEATURES = [
    "accel_max",
    "accel_mean",
    "accel_std",

    "gyro_max",
    "gyro_mean",
    "gyro_std",

    "speed_start",
    "speed_end",
    "speed_max",
    "speed_min",
    "speed_drop",
]


print("Loading clean feature datasets...")

train_df = pd.read_csv(TRAIN_PATH)
validation_df = pd.read_csv(VALIDATION_PATH)


print(f"Training events:   {len(train_df):,}")
print(f"Validation events: {len(validation_df):,}")


# -------------------------------------------------
# Binary labels
# Crash = 1
# Near Miss / Normal Driving = 0
# -------------------------------------------------

y_train = (train_df["label"] == 0).astype(int)
y_validation = (validation_df["label"] == 0).astype(int)

X_train = train_df[FEATURES]
X_validation = validation_df[FEATURES]


print("\nTraining class counts:")
print(y_train.value_counts().sort_index())

print("\nValidation class counts:")
print(y_validation.value_counts().sort_index())


# -------------------------------------------------
# Sanity check
# -------------------------------------------------

if X_train.isna().any().any():
    raise ValueError("NaN found in training features.")

if X_validation.isna().any().any():
    raise ValueError("NaN found in validation features.")


# -------------------------------------------------
# Train Random Forest
# -------------------------------------------------

print("\nTraining Random Forest...")

model = RandomForestClassifier(
    n_estimators=300,
    class_weight="balanced_subsample",
    random_state=42,
    n_jobs=-1,
)

model.fit(
    X_train,
    y_train,
)

print("Training complete.")


# -------------------------------------------------
# Validation predictions
# -------------------------------------------------

validation_probability = model.predict_proba(
    X_validation
)[:, 1]

# Version 1 uses the standard probability threshold.
THRESHOLD = 0.50

validation_prediction = (
    validation_probability >= THRESHOLD
).astype(int)


tn, fp, fn, tp = confusion_matrix(
    y_validation,
    validation_prediction,
    labels=[0, 1],
).ravel()


accuracy = accuracy_score(
    y_validation,
    validation_prediction,
)

precision = precision_score(
    y_validation,
    validation_prediction,
    zero_division=0,
)

recall = recall_score(
    y_validation,
    validation_prediction,
    zero_division=0,
)

f1 = f1_score(
    y_validation,
    validation_prediction,
    zero_division=0,
)

roc_auc = roc_auc_score(
    y_validation,
    validation_probability,
)

pr_auc = average_precision_score(
    y_validation,
    validation_probability,
)


print("\n===================================")
print("RANDOM FOREST V1")
print("===================================")

print(f"Probability threshold: {THRESHOLD:.2f}")


print("\n===================================")
print("CONFUSION MATRIX")
print("===================================")

print(f"True Negatives : {tn:,}")
print(f"False Positives: {fp:,}")
print(f"False Negatives: {fn:,}")
print(f"True Positives : {tp:,}")


print("\n===================================")
print("VALIDATION METRICS")
print("===================================")

print(f"Accuracy : {accuracy:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall   : {recall:.4f}")
print(f"F1 Score : {f1:.4f}")
print(f"ROC-AUC  : {roc_auc:.4f}")
print(f"PR-AUC   : {pr_auc:.4f}")


# -------------------------------------------------
# Compare with our simple 2.0 g rule
# on the SAME validation dataset
# -------------------------------------------------

rule_prediction = (
    validation_df["accel_max"] >= 2.0
).astype(int)

rule_tn, rule_fp, rule_fn, rule_tp = confusion_matrix(
    y_validation,
    rule_prediction,
    labels=[0, 1],
).ravel()

rule_precision = precision_score(
    y_validation,
    rule_prediction,
    zero_division=0,
)

rule_recall = recall_score(
    y_validation,
    rule_prediction,
    zero_division=0,
)

rule_f1 = f1_score(
    y_validation,
    rule_prediction,
    zero_division=0,
)


print("\n===================================")
print("2.0 g RULE ON SAME VALIDATION SET")
print("===================================")

print(f"True Negatives : {rule_tn:,}")
print(f"False Positives: {rule_fp:,}")
print(f"False Negatives: {rule_fn:,}")
print(f"True Positives : {rule_tp:,}")

print()
print(f"Precision: {rule_precision:.4f}")
print(f"Recall   : {rule_recall:.4f}")
print(f"F1 Score : {rule_f1:.4f}")


# -------------------------------------------------
# Feature importance
# -------------------------------------------------

importance_df = pd.DataFrame({
    "feature": FEATURES,
    "importance": model.feature_importances_,
})

importance_df = importance_df.sort_values(
    "importance",
    ascending=False,
)


print("\n===================================")
print("FEATURE IMPORTANCE")
print("===================================")

print(
    importance_df.to_string(
        index=False,
    )
)


# -------------------------------------------------
# Save model
# -------------------------------------------------

MODEL_PATH.parent.mkdir(
    parents=True,
    exist_ok=True,
)

joblib.dump(
    {
        "model": model,
        "features": FEATURES,
        "threshold": THRESHOLD,
    },
    MODEL_PATH,
)


print("\n===================================")
print("MODEL SAVED")
print("===================================")

print(MODEL_PATH)
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)


DATA_PATH = "data/eda_features_3000.csv"

# Simple baseline:
# predict crash if max acceleration is at least this value
ACCEL_THRESHOLD_G = 2.0


print("Loading local feature data...")

df = pd.read_csv(DATA_PATH)

# Binary classification:
# Crash = 1
# Near Miss / Normal Driving = 0
y_true = (df["class"] == "Crash").astype(int)

y_pred = (df["accel_max"] >= ACCEL_THRESHOLD_G).astype(int)


tn, fp, fn, tp = confusion_matrix(
    y_true,
    y_pred,
    labels=[0, 1],
).ravel()


print("\n===================================")
print("RULE-BASED CRASH DETECTOR")
print("===================================")

print(f"Rule: accel_max >= {ACCEL_THRESHOLD_G} g")


print("\n===================================")
print("CONFUSION MATRIX")
print("===================================")

print(f"True Negatives : {tn}")
print(f"False Positives: {fp}")
print(f"False Negatives: {fn}")
print(f"True Positives : {tp}")


accuracy = accuracy_score(y_true, y_pred)
precision = precision_score(y_true, y_pred, zero_division=0)
recall = recall_score(y_true, y_pred, zero_division=0)
f1 = f1_score(y_true, y_pred, zero_division=0)


print("\n===================================")
print("METRICS")
print("===================================")

print(f"Accuracy : {accuracy:.3f}")
print(f"Precision: {precision:.3f}")
print(f"Recall   : {recall:.3f}")
print(f"F1 Score : {f1:.3f}")


# Compare against a useless model that always predicts "no crash"
always_no_crash_accuracy = (y_true == 0).mean()

print("\n===================================")
print("NAIVE BASELINE")
print("===================================")

print(
    "Accuracy if we always predict 'no crash': "
    f"{always_no_crash_accuracy:.3f}"
)


# Inspect mistakes
false_negatives = df[
    (y_true == 1) & (y_pred == 0)
]

false_positives = df[
    (y_true == 0) & (y_pred == 1)
]


columns = [
    "event_id",
    "class",
    "accel_max",
    "accel_std",
    "gyro_max",
    "gyro_std",
    "speed_drop",
]


print("\n===================================")
print("SAMPLE FALSE NEGATIVES")
print("===================================")

print(
    false_negatives[columns]
    .sort_values("accel_max")
    .head(10)
    .to_string(index=False)
)


print("\n===================================")
print("SAMPLE FALSE POSITIVES")
print("===================================")

print(
    false_positives[columns]
    .sort_values("accel_max", ascending=False)
    .head(10)
    .to_string(index=False)
)
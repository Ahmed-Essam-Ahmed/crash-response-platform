from pathlib import Path

import joblib
import pandas as pd


MODEL_PATH = Path("models/random_forest_v1.joblib")
VALIDATION_PATH = Path("data/validation_features_clean.csv")

THRESHOLD = 0.190


FEATURES_TO_SHOW = [
    "event_id",
    "class",
    "crash_probability",
    "accel_max",
    "accel_std",
    "gyro_max",
    "gyro_std",
    "speed_drop",
]


print("Loading model and validation data...")

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
features = bundle["features"]

df = pd.read_csv(VALIDATION_PATH)

X = df[features]

df["crash_probability"] = (
    model.predict_proba(X)[:, 1]
)

df["true_crash"] = (
    df["label"] == 0
).astype(int)

df["predicted_crash"] = (
    df["crash_probability"] >= THRESHOLD
).astype(int)


# -------------------------------------------------
# Separate errors
# -------------------------------------------------

false_positives = df[
    (df["true_crash"] == 0)
    & (df["predicted_crash"] == 1)
].copy()

false_negatives = df[
    (df["true_crash"] == 1)
    & (df["predicted_crash"] == 0)
].copy()


print("\n===================================")
print("ERROR SUMMARY")
print("===================================")

print(f"Threshold: {THRESHOLD:.3f}")
print(f"False positives: {len(false_positives):,}")
print(f"False negatives: {len(false_negatives):,}")


# -------------------------------------------------
# What classes create false alarms?
# -------------------------------------------------

print("\n===================================")
print("FALSE POSITIVES BY TRUE CLASS")
print("===================================")

print(
    false_positives["class"]
    .value_counts()
)


print("\nFalse-positive rate by negative class:")

for class_name in [
    "Near Miss",
    "Normal Driving",
]:

    class_df = df[
        df["class"] == class_name
    ]

    class_fp = false_positives[
        false_positives["class"] == class_name
    ]

    rate = len(class_fp) / len(class_df)

    print(
        f"{class_name}: "
        f"{len(class_fp):,} / "
        f"{len(class_df):,} "
        f"= {rate:.2%}"
    )


# -------------------------------------------------
# Most confident false positives
# -------------------------------------------------

print("\n===================================")
print("MOST CONFIDENT FALSE POSITIVES")
print("===================================")

print(
    false_positives[
        FEATURES_TO_SHOW
    ]
    .sort_values(
        "crash_probability",
        ascending=False,
    )
    .head(15)
    .to_string(index=False)
)


# -------------------------------------------------
# Most confidently missed crashes
# -------------------------------------------------

print("\n===================================")
print("LOWEST-SCORE MISSED CRASHES")
print("===================================")

print(
    false_negatives[
        FEATURES_TO_SHOW
    ]
    .sort_values(
        "crash_probability",
        ascending=True,
    )
    .head(15)
    .to_string(index=False)
)


# -------------------------------------------------
# Compare against 2.0 g rule
# -------------------------------------------------

df["rule_prediction"] = (
    df["accel_max"] >= 2.0
).astype(int)


rf_only_crashes = df[
    (df["true_crash"] == 1)
    & (df["predicted_crash"] == 1)
    & (df["rule_prediction"] == 0)
]

rule_only_crashes = df[
    (df["true_crash"] == 1)
    & (df["predicted_crash"] == 0)
    & (df["rule_prediction"] == 1)
]


print("\n===================================")
print("MODEL VS 2.0 g RULE")
print("===================================")

print(
    "Crashes caught by RF but missed "
    f"by rule: {len(rf_only_crashes):,}"
)

print(
    "Crashes caught by rule but missed "
    f"by RF: {len(rule_only_crashes):,}"
)
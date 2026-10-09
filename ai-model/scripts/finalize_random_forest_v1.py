from pathlib import Path

import joblib


INPUT_MODEL = Path(
    "models/random_forest_v1.joblib"
)

OUTPUT_MODEL = Path(
    "models/random_forest_v1_final.joblib"
)

FINAL_THRESHOLD = 0.190


print("Loading trained Random Forest...")

bundle = joblib.load(INPUT_MODEL)

bundle["threshold"] = FINAL_THRESHOLD

bundle["model_version"] = "random_forest_v1"
bundle["decision_rule"] = (
    "Crash if Random Forest score >= 0.190"
)

bundle["validation_selection"] = {
    "threshold": 0.190,
    "precision": 0.764066,
    "recall": 0.964032,
    "f1": 0.852480,
}


joblib.dump(
    bundle,
    OUTPUT_MODEL,
)


print("\nFinal model saved:")
print(OUTPUT_MODEL)

print(
    f"\nFrozen threshold: "
    f"{FINAL_THRESHOLD:.3f}"
)
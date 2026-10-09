from datasets import load_dataset
import numpy as np
import pandas as pd


DATASET_NAME = "vzc-research-chapter/VZCrash"

LABEL_NAMES = {
    0: "Crash",
    1: "Near Miss",
    2: "Normal Driving",
}


def magnitude(values):
    values = np.asarray(values, dtype=float)
    return np.linalg.norm(values, axis=1)


def extract_features(event):
    accel = magnitude(event["gsensor"])
    gyro = magnitude(event["gyro"])
    speed = np.asarray(event["gps_speed"], dtype=float)

    return {
        "event_id": event["event_id"],
        "label": event["label"],
        "class": LABEL_NAMES[event["label"]],
        "vehicle_size": event["vehiclesize"],
        "gyro_is_hd": event["gyro_is_hd"],

        "accel_max": accel.max(),
        "accel_mean": accel.mean(),
        "accel_std": accel.std(),

        "gyro_max": gyro.max(),
        "gyro_mean": gyro.mean(),
        "gyro_std": gyro.std(),

        "speed_start": speed[0],
        "speed_end": speed[-1],
        "speed_max": speed.max(),
        "speed_min": speed.min(),
        "speed_drop": speed[0] - speed[-1],
    }


print("Loading VZCrash validation split...")

dataset = load_dataset(
    DATASET_NAME,
    split="validation",
    streaming=True,
)

rows = []

for i, event in enumerate(dataset):
    rows.append(extract_features(event))

    if (i + 1) % 1000 == 0:
        print(f"Processed {i + 1} validation events...")


df = pd.DataFrame(rows)

output_path = "data/validation_features_full.csv"
df.to_csv(output_path, index=False)

print(f"\nSaved {len(df)} events to {output_path}")

print("\nClass counts:")
print(df["class"].value_counts())

print("\nGyro resolution:")
print(df["gyro_is_hd"].value_counts())
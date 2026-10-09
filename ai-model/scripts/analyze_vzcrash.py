from datasets import load_dataset
import numpy as np
import pandas as pd


DATASET_NAME = "vzc-research-chapter/VZCrash"

LABEL_NAMES = {
    0: "Crash",
    1: "Near Miss",
    2: "Normal Driving",
}

# We deliberately keep this small for our first analysis.
MAX_EVENTS_TO_SCAN = 3000


def magnitude(values):
    """
    Convert X/Y/Z sensor readings into a single magnitude value.
    """
    values = np.asarray(values, dtype=float)
    return np.linalg.norm(values, axis=1)


def extract_features(event):
    """
    Convert one 16-second raw VZCrash event into useful summary features.
    """

    accel = magnitude(event["gsensor"])
    gyro = magnitude(event["gyro"])
    speed = np.asarray(event["gps_speed"], dtype=float)

    return {
        "event_id": event["event_id"],
        "label": event["label"],
        "class": LABEL_NAMES[event["label"]],
        "vehicle_size": event["vehiclesize"],
        "gyro_is_hd": event["gyro_is_hd"],

        # Accelerometer features
        "accel_max": accel.max(),
        "accel_mean": accel.mean(),
        "accel_std": accel.std(),

        # Gyroscope features
        "gyro_max": gyro.max(),
        "gyro_mean": gyro.mean(),
        "gyro_std": gyro.std(),

        # Speed features
        "speed_start": speed[0],
        "speed_end": speed[-1],
        "speed_max": speed.max(),
        "speed_min": speed.min(),

        # Positive value = vehicle ended slower than it started
        "speed_drop": speed[0] - speed[-1],
    }


print("Loading VZCrash in streaming mode...")

dataset = load_dataset(
    DATASET_NAME,
    split="train",
    streaming=True,
)

rows = []

for i, event in enumerate(dataset):

    rows.append(extract_features(event))

    if (i + 1) % 500 == 0:
        print(f"Processed {i + 1} events...")

    if i + 1 >= MAX_EVENTS_TO_SCAN:
        break


df = pd.DataFrame(rows)

output_path = "data/eda_features_3000.csv"
df.to_csv(output_path, index=False)

print(f"\nSaved extracted features to: {output_path}")

print("\n===================================")
print("EVENTS ANALYZED")
print("===================================")
print(len(df))


print("\n===================================")
print("CLASS COUNTS")
print("===================================")
print(df["class"].value_counts())


print("\n===================================")
print("GYROSCOPE RESOLUTION")
print("===================================")
print(df["gyro_is_hd"].value_counts())


features = [
    "accel_max",
    "accel_mean",
    "accel_std",
    "gyro_max",
    "gyro_mean",
    "gyro_std",
    "speed_start",
    "speed_end",
    "speed_drop",
]


print("\n===================================")
print("AVERAGE FEATURE VALUES BY CLASS")
print("===================================")

print(
    df.groupby("class")[features]
      .mean()
      .round(2)
)


print("\n===================================")
print("MEDIAN FEATURE VALUES BY CLASS")
print("===================================")

print(
    df.groupby("class")[features]
      .median()
      .round(2)
)
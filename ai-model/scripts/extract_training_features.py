from datasets import load_dataset
import numpy as np
import pandas as pd


DATASET_NAME = "vzc-research-chapter/VZCrash"

MAX_EVENTS = 15000
SHUFFLE_BUFFER = 20000
RANDOM_SEED = 42

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

        # Accelerometer
        "accel_max": accel.max(),
        "accel_mean": accel.mean(),
        "accel_std": accel.std(),

        # Gyroscope
        "gyro_max": gyro.max(),
        "gyro_mean": gyro.mean(),
        "gyro_std": gyro.std(),

        # Speed
        "speed_start": speed[0],
        "speed_end": speed[-1],
        "speed_max": speed.max(),
        "speed_min": speed.min(),
        "speed_drop": speed[0] - speed[-1],
    }


print("Loading VZCrash training split...")

dataset = load_dataset(
    DATASET_NAME,
    split="train",
    streaming=True,
)

print("Shuffling training stream...")

dataset = dataset.shuffle(
    seed=RANDOM_SEED,
    buffer_size=SHUFFLE_BUFFER,
)

rows = []

for i, event in enumerate(dataset):
    rows.append(extract_features(event))

    if (i + 1) % 1000 == 0:
        print(f"Processed {i + 1} training events...")

    if i + 1 >= MAX_EVENTS:
        break


df = pd.DataFrame(rows)

output_path = "data/training_features_15000.csv"

df.to_csv(output_path, index=False)

print(f"\nSaved {len(df)} events to {output_path}")

print("\nClass counts:")
print(df["class"].value_counts())

print("\nGyro resolution:")
print(df["gyro_is_hd"].value_counts())
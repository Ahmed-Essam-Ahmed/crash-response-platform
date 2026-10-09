from pathlib import Path

import numpy as np
import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")

# One duplicate pair found by our audit
TRAIN_ID = 1609042
TEST_ID = 1609043


def find_event(split_name, event_id):
    files = sorted(DATA_DIR.glob(f"{split_name}-*.parquet"))

    for file in files:
        table = pq.read_table(file)

        df = table.to_pandas()

        match = df[df["event_id"] == event_id]

        if not match.empty:
            return match.iloc[0]

    raise ValueError(
        f"Event {event_id} not found in {split_name}"
    )


train_event = find_event("train", TRAIN_ID)
test_event = find_event("test", TEST_ID)


print("===================================")
print("METADATA")
print("===================================")

fields = [
    "event_id",
    "label",
    "vehiclesize",
    "gyro_is_hd",
]

for field in fields:
    print(
        f"{field}:",
        train_event[field],
        "|",
        test_event[field],
    )


train_g = np.stack(train_event["gsensor"]).astype(np.float32)
test_g = np.stack(test_event["gsensor"]).astype(np.float32)

train_gyro = np.stack(train_event["gyro"]).astype(np.float32)
test_gyro = np.stack(test_event["gyro"]).astype(np.float32)

train_speed = np.asarray(
    train_event["gps_speed"],
    dtype=np.float32
)

test_speed = np.asarray(
    test_event["gps_speed"],
    dtype=np.float32
)


print("\n===================================")
print("LENGTHS")
print("===================================")

print("G-sensor:", len(train_g), len(test_g))
print("Gyro:", len(train_gyro), len(test_gyro))
print("Speed:", len(train_speed), len(test_speed))


print("\n===================================")
print("EXACT ARRAY COMPARISON")
print("===================================")

print(
    "G-sensor identical:",
    np.array_equal(train_g, test_g),
)

print(
    "Gyro identical:",
    np.array_equal(train_gyro, test_gyro),
)

print(
    "Speed identical:",
    np.array_equal(train_speed, test_speed),
)


print("\n===================================")
print("MAX ABSOLUTE DIFFERENCE")
print("===================================")

print(
    "G-sensor:",
    np.max(np.abs(train_g - test_g)),
)

print(
    "Gyro:",
    np.max(np.abs(train_gyro - test_gyro)),
)

print(
    "Speed:",
    np.max(np.abs(train_speed - test_speed)),
)
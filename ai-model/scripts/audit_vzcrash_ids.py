from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")

LABEL_NAMES = {
    0: "Crash",
    1: "Near Miss",
    2: "Normal Driving",
}


def load_split(split_name):
    files = sorted(DATA_DIR.glob(f"{split_name}-*.parquet"))

    if not files:
        raise FileNotFoundError(
            f"No files found for split: {split_name}"
        )

    frames = []

    print(f"\nReading {split_name} metadata...")

    for file in files:
        table = pq.read_table(
            file,
            columns=[
                "event_id",
                "label",
                "gyro_is_hd",
            ],
        )

        frames.append(table.to_pandas())

    df = pd.concat(frames, ignore_index=True)

    return files, df


splits = {}

for split_name in ["train", "validation", "test"]:

    files, df = load_split(split_name)
    splits[split_name] = df

    print("\n===================================")
    print(split_name.upper())
    print("===================================")

    print(f"Files: {len(files)}")
    print(f"Events: {len(df)}")

    print("\nClass counts:")
    print(
        df["label"]
        .map(LABEL_NAMES)
        .value_counts()
    )

    print("\nGyroscope resolution:")
    print(df["gyro_is_hd"].value_counts())

    duplicate_count = df["event_id"].duplicated().sum()

    print(
        f"\nDuplicate event IDs inside "
        f"{split_name}: {duplicate_count}"
    )


print("\n===================================")
print("CROSS-SPLIT EVENT ID CHECK")
print("===================================")

train_ids = set(splits["train"]["event_id"])
validation_ids = set(splits["validation"]["event_id"])
test_ids = set(splits["test"]["event_id"])

train_validation_overlap = train_ids & validation_ids
train_test_overlap = train_ids & test_ids
validation_test_overlap = validation_ids & test_ids

print(
    "Train <-> Validation overlap:",
    len(train_validation_overlap),
)

print(
    "Train <-> Test overlap:",
    len(train_test_overlap),
)

print(
    "Validation <-> Test overlap:",
    len(validation_test_overlap),
)


print("\n===================================")
print("CONFLICTING LABEL CHECK")
print("===================================")

combined = pd.concat(
    [
        splits["train"],
        splits["validation"],
        splits["test"],
    ],
    ignore_index=True,
)

label_counts_per_event = (
    combined.groupby("event_id")["label"]
    .nunique()
)

conflicting = label_counts_per_event[
    label_counts_per_event > 1
]

print(
    "Event IDs with conflicting labels:",
    len(conflicting),
)


if (
    len(train_validation_overlap) == 0
    and len(train_test_overlap) == 0
    and len(validation_test_overlap) == 0
    and len(conflicting) == 0
):
    print("\nBasic split integrity check: PASSED")
else:
    print("\nWARNING: Split integrity problems detected.")
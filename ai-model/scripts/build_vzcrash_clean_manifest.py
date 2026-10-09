from pathlib import Path
import hashlib

import numpy as np
import pandas as pd
import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")
OUTPUT_PATH = Path("data/vzcrash_clean_manifest.csv")

# Higher number = higher priority.
# We protect the test set most.
SPLIT_PRIORITY = {
    "train": 1,
    "validation": 2,
    "test": 3,
}


def sensor_hash(gsensor, gyro, gps_speed):
    gsensor = np.stack(gsensor).astype(np.float32)
    gyro = np.stack(gyro).astype(np.float32)
    gps_speed = np.asarray(gps_speed, dtype=np.float32)

    h = hashlib.blake2b(digest_size=20)

    h.update(gsensor.tobytes())
    h.update(gyro.tobytes())
    h.update(gps_speed.tobytes())

    return h.hexdigest()


rows = []


for split_name in ["train", "validation", "test"]:

    files = sorted(
        DATA_DIR.glob(f"{split_name}-*.parquet")
    )

    total = 0

    print(f"\nScanning {split_name}...")

    for file in files:

        parquet_file = pq.ParquetFile(file)

        for batch in parquet_file.iter_batches(
            batch_size=256,
            columns=[
                "event_id",
                "label",
                "vehiclesize",
                "gyro_is_hd",
                "gsensor",
                "gyro",
                "gps_speed",
            ],
        ):

            data = batch.to_pydict()

            for i in range(len(data["event_id"])):

                fingerprint = sensor_hash(
                    data["gsensor"][i],
                    data["gyro"][i],
                    data["gps_speed"][i],
                )

                rows.append({
                    "split": split_name,
                    "event_id": data["event_id"][i],
                    "label": data["label"][i],
                    "vehicle_size": data["vehiclesize"][i],
                    "gyro_is_hd": data["gyro_is_hd"][i],
                    "sensor_hash": fingerprint,
                    "priority": SPLIT_PRIORITY[split_name],
                })

                total += 1

                if total % 10000 == 0:
                    print(
                        f"Processed {total:,} "
                        f"{split_name} events..."
                    )


df = pd.DataFrame(rows)

print(f"\nTotal events scanned: {len(df):,}")


# ------------------------------------------
# Choose one canonical event for each hash
# ------------------------------------------

# Highest-priority split first.
# If there are multiple identical events in that split,
# keep the lowest event_id deterministically.
df = df.sort_values(
    ["sensor_hash", "priority", "event_id"],
    ascending=[True, False, True],
)


canonical = (
    df.groupby("sensor_hash", as_index=False)
    .first()[
        [
            "sensor_hash",
            "split",
            "event_id",
        ]
    ]
    .rename(
        columns={
            "split": "canonical_split",
            "event_id": "canonical_event_id",
        }
    )
)


df = df.merge(
    canonical,
    on="sensor_hash",
    how="left",
)


df["keep"] = (
    (df["split"] == df["canonical_split"])
    &
    (df["event_id"] == df["canonical_event_id"])
)


def drop_reason(row):

    if row["keep"]:
        return "keep"

    if row["split"] != row["canonical_split"]:
        return "cross_split_duplicate"

    return "within_split_duplicate"


df["reason"] = df.apply(
    drop_reason,
    axis=1,
)


# ------------------------------------------
# Summary
# ------------------------------------------

print("\n===================================")
print("ORIGINAL COUNTS")
print("===================================")

print(
    df.groupby("split")
    .size()
)


print("\n===================================")
print("CLEAN COUNTS")
print("===================================")

clean_df = df[df["keep"]]

print(
    clean_df.groupby("split")
    .size()
)


print("\n===================================")
print("DROPPED COUNTS")
print("===================================")

dropped_df = df[~df["keep"]]

print(
    dropped_df.groupby(
        ["split", "reason"]
    )
    .size()
)


print("\n===================================")
print("DROPPED BY LABEL")
print("===================================")

print(
    pd.crosstab(
        dropped_df["split"],
        dropped_df["label"],
    )
)


# ------------------------------------------
# Final integrity check
# ------------------------------------------

remaining_duplicate_hashes = (
    clean_df["sensor_hash"]
    .duplicated()
    .sum()
)


print("\n===================================")
print("FINAL CHECK")
print("===================================")

print(
    "Duplicate sensor hashes among "
    "kept events:",
    remaining_duplicate_hashes,
)


# ------------------------------------------
# Save manifest
# ------------------------------------------

df = df.sort_values(
    ["split", "event_id"]
)

df.to_csv(
    OUTPUT_PATH,
    index=False,
)


print("\n===================================")
print("MANIFEST")
print("===================================")

print(
    f"Saved clean manifest to: "
    f"{OUTPUT_PATH}"
)
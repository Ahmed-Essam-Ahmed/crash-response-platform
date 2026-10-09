from pathlib import Path
import hashlib

import numpy as np
import pandas as pd
import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")
OUTPUT_PATH = Path("data/vzcrash_duplicate_report.csv")


def sensor_hash(gsensor, gyro, gps_speed):
    """
    Produce a fingerprint for the complete sensor recording.
    """
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

    files = sorted(DATA_DIR.glob(f"{split_name}-*.parquet"))

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
                })

                total += 1

                if total % 10000 == 0:
                    print(
                        f"Processed {total:,} "
                        f"{split_name} events..."
                    )


df = pd.DataFrame(rows)

print("\nTotal events scanned:", len(df))


# -------------------------------------------------
# Identify hashes occurring more than once anywhere
# -------------------------------------------------

hash_sizes = df.groupby("sensor_hash").size()

duplicate_hashes = set(
    hash_sizes[hash_sizes > 1].index
)

duplicate_df = df[
    df["sensor_hash"].isin(duplicate_hashes)
].copy()


# -------------------------------------------------
# Cross-split duplicates
# -------------------------------------------------

split_count_per_hash = (
    df.groupby("sensor_hash")["split"]
    .nunique()
)

cross_split_hashes = set(
    split_count_per_hash[
        split_count_per_hash > 1
    ].index
)

cross_df = df[
    df["sensor_hash"].isin(cross_split_hashes)
].copy()


print("\n===================================")
print("OVERALL DUPLICATES")
print("===================================")

print(
    "Duplicate sensor hash groups:",
    len(duplicate_hashes),
)

print(
    "Events involved in any duplicate:",
    len(duplicate_df),
)


print("\n===================================")
print("CROSS-SPLIT DUPLICATES")
print("===================================")

print(
    "Cross-split duplicate hash groups:",
    len(cross_split_hashes),
)

print(
    "Total events involved:",
    len(cross_df),
)


print("\nEvents involved by split:")
print(
    cross_df["split"]
    .value_counts()
)


print("\nEvents involved by label:")
print(
    cross_df["label"]
    .value_counts()
    .sort_index()
)


# -------------------------------------------------
# Which split combinations occur?
# -------------------------------------------------

def split_signature(series):
    return " + ".join(
        sorted(set(series))
    )


split_combinations = (
    cross_df.groupby("sensor_hash")["split"]
    .apply(split_signature)
    .value_counts()
)


print("\n===================================")
print("SPLIT COMBINATIONS")
print("===================================")

print(split_combinations)


# -------------------------------------------------
# Label conflicts
# -------------------------------------------------

label_counts = (
    cross_df.groupby("sensor_hash")["label"]
    .nunique()
)

conflicting_label_hashes = set(
    label_counts[label_counts > 1].index
)


print("\n===================================")
print("LABEL CONSISTENCY")
print("===================================")

print(
    "Cross-split hashes with "
    "conflicting labels:",
    len(conflicting_label_hashes),
)


# -------------------------------------------------
# Metadata differences
# -------------------------------------------------

vehicle_size_counts = (
    cross_df.groupby("sensor_hash")["vehicle_size"]
    .nunique()
)

gyro_mode_counts = (
    cross_df.groupby("sensor_hash")["gyro_is_hd"]
    .nunique()
)


print("\n===================================")
print("METADATA CONSISTENCY")
print("===================================")

print(
    "Hashes with different vehicle_size:",
    int((vehicle_size_counts > 1).sum()),
)

print(
    "Hashes with different gyro_is_hd:",
    int((gyro_mode_counts > 1).sum()),
)


# -------------------------------------------------
# How many duplicated events are in each class/split?
# -------------------------------------------------

print("\n===================================")
print("DUPLICATED EVENTS BY SPLIT / LABEL")
print("===================================")

print(
    pd.crosstab(
        cross_df["split"],
        cross_df["label"],
    )
)


# -------------------------------------------------
# Save detailed report
# -------------------------------------------------

cross_df = cross_df.sort_values(
    ["sensor_hash", "split", "event_id"]
)

cross_df.to_csv(
    OUTPUT_PATH,
    index=False,
)


print("\n===================================")
print("REPORT")
print("===================================")

print(
    f"Saved detailed report to: "
    f"{OUTPUT_PATH}"
)
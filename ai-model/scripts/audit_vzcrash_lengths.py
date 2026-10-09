from pathlib import Path
from collections import Counter

import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")


def audit_lengths(split_name):
    files = sorted(DATA_DIR.glob(f"{split_name}-*.parquet"))

    gsensor_lengths = Counter()
    gyro_lengths = Counter()
    speed_lengths = Counter()

    combinations = Counter()

    total = 0

    print(f"\nAuditing lengths in {split_name}...")

    for file in files:

        parquet_file = pq.ParquetFile(file)

        for batch in parquet_file.iter_batches(
            batch_size=512,
            columns=[
                "event_id",
                "gsensor",
                "gyro",
                "gps_speed",
            ],
        ):
            data = batch.to_pydict()

            for i in range(len(data["event_id"])):

                g_len = len(data["gsensor"][i])
                gyro_len = len(data["gyro"][i])
                speed_len = len(data["gps_speed"][i])

                gsensor_lengths[g_len] += 1
                gyro_lengths[gyro_len] += 1
                speed_lengths[speed_len] += 1

                combinations[
                    (g_len, gyro_len, speed_len)
                ] += 1

                total += 1

    print("\n===================================")
    print(split_name.upper())
    print("===================================")

    print(f"Total events: {total:,}")

    print("\nMost common G-sensor lengths:")
    for length, count in gsensor_lengths.most_common(10):
        print(f"{length}: {count:,}")

    print("\nMost common gyro lengths:")
    for length, count in gyro_lengths.most_common(10):
        print(f"{length}: {count:,}")

    print("\nMost common GPS speed lengths:")
    for length, count in speed_lengths.most_common(10):
        print(f"{length}: {count:,}")

    print("\nMost common length combinations:")
    for lengths, count in combinations.most_common(15):
        print(
            f"gsensor={lengths[0]}, "
            f"gyro={lengths[1]}, "
            f"speed={lengths[2]} "
            f"-> {count:,}"
        )


for split in [
    "train",
    "validation",
    "test",
]:
    audit_lengths(split)
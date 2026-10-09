from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")
MANIFEST_PATH = Path("data/vzcrash_clean_manifest.csv")

LABEL_NAMES = {
    0: "Crash",
    1: "Near Miss",
    2: "Normal Driving",
}


def magnitude(values):
    values = np.stack(values).astype(np.float32)
    return np.linalg.norm(values, axis=1)


def extract_features(
    event_id,
    label,
    vehicle_size,
    gyro_is_hd,
    gsensor,
    gyro,
    gps_speed,
):
    accel = magnitude(gsensor)
    gyro_mag = magnitude(gyro)

    speed = np.asarray(
        gps_speed,
        dtype=np.float32,
    )

    return {
        "event_id": event_id,
        "label": label,
        "class": LABEL_NAMES[label],
        "vehicle_size": vehicle_size,
        "gyro_is_hd": gyro_is_hd,

        # Keep raw sequence lengths as metadata
        "gsensor_len": len(gsensor),
        "gyro_len": len(gyro),
        "speed_len": len(gps_speed),

        # Accelerometer features
        "accel_max": float(accel.max()),
        "accel_mean": float(accel.mean()),
        "accel_std": float(accel.std()),

        # Gyroscope features
        "gyro_max": float(gyro_mag.max()),
        "gyro_mean": float(gyro_mag.mean()),
        "gyro_std": float(gyro_mag.std()),

        # Speed features
        "speed_start": float(speed[0]),
        "speed_end": float(speed[-1]),
        "speed_max": float(speed.max()),
        "speed_min": float(speed.min()),
        "speed_drop": float(speed[0] - speed[-1]),
    }


print("Loading clean manifest...")

manifest = pd.read_csv(MANIFEST_PATH)

manifest = manifest[
    manifest["keep"] == True
]


def extract_split(split_name):

    print(f"\n===================================")
    print(f"EXTRACTING {split_name.upper()}")
    print("===================================")

    split_manifest = manifest[
        manifest["split"] == split_name
    ]

    keep_ids = set(
        split_manifest["event_id"]
    )

    print(
        f"Events expected: {len(keep_ids):,}"
    )

    files = sorted(
        DATA_DIR.glob(
            f"{split_name}-*.parquet"
        )
    )

    rows = []
    processed = 0

    for file in files:

        print(f"\nReading {file.name}")

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

            for i in range(
                len(data["event_id"])
            ):

                event_id = data["event_id"][i]

                if event_id not in keep_ids:
                    continue

                row = extract_features(
                    event_id=event_id,
                    label=data["label"][i],
                    vehicle_size=data["vehiclesize"][i],
                    gyro_is_hd=data["gyro_is_hd"][i],
                    gsensor=data["gsensor"][i],
                    gyro=data["gyro"][i],
                    gps_speed=data["gps_speed"][i],
                )

                rows.append(row)

                processed += 1

                if processed % 10000 == 0:
                    print(
                        f"Processed "
                        f"{processed:,} "
                        f"{split_name} events..."
                    )

    df = pd.DataFrame(rows)

    output_path = Path(
        f"data/{split_name}_features_clean.csv"
    )

    df.to_csv(
        output_path,
        index=False,
    )

    print("\n-----------------------------------")
    print(f"Saved: {output_path}")
    print(f"Events extracted: {len(df):,}")

    print("\nClass counts:")
    print(
        df["class"]
        .value_counts()
    )

    print("\nGyro resolution:")
    print(
        df["gyro_is_hd"]
        .value_counts()
    )

    if len(df) != len(keep_ids):
        print(
            "\nWARNING: Extracted count does "
            "not match manifest!"
        )
    else:
        print(
            "\nManifest count check: PASSED"
        )

    return df


test_df = extract_split("test")


print("\n===================================")
print("DONE")
print("===================================")

print(
    f"Clean test features: "
    f"{len(test_df):,}"
)
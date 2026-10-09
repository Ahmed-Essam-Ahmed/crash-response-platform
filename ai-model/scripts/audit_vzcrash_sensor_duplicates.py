from pathlib import Path
import hashlib

import numpy as np
import pyarrow.parquet as pq


DATA_DIR = Path("data/VZCrash/data")

EXPECTED_GSENSOR_LENGTH = 1600
EXPECTED_GYRO_LENGTH = 1600
EXPECTED_SPEED_LENGTH = 16


def sensor_hash(gsensor, gyro, gps_speed):
    """
    Create a stable fingerprint from the three sensor streams.
    """

    gsensor = np.asarray(gsensor, dtype=np.float32)
    gyro = np.asarray(gyro, dtype=np.float32)
    gps_speed = np.asarray(gps_speed, dtype=np.float32)

    hasher = hashlib.blake2b(digest_size=20)

    hasher.update(gsensor.tobytes())
    hasher.update(gyro.tobytes())
    hasher.update(gps_speed.tobytes())

    return hasher.hexdigest()


def audit_split(split_name):
    files = sorted(DATA_DIR.glob(f"{split_name}-*.parquet"))

    hashes = {}
    malformed = []
    invalid_values = []

    total = 0

    print(f"\nAuditing {split_name}...")

    for file in files:

        parquet_file = pq.ParquetFile(file)

        for batch in parquet_file.iter_batches(
            batch_size=256,
            columns=[
                "event_id",
                "label",
                "gsensor",
                "gyro",
                "gps_speed",
            ],
        ):

            data = batch.to_pydict()

            for i in range(len(data["event_id"])):

                event_id = data["event_id"][i]
                label = data["label"][i]

                gsensor = np.asarray(
                    data["gsensor"][i],
                    dtype=np.float32,
                )

                gyro = np.asarray(
                    data["gyro"][i],
                    dtype=np.float32,
                )

                gps_speed = np.asarray(
                    data["gps_speed"][i],
                    dtype=np.float32,
                )

                total += 1

                # Check expected sequence lengths
                if (
                    len(gsensor) != EXPECTED_GSENSOR_LENGTH
                    or len(gyro) != EXPECTED_GYRO_LENGTH
                    or len(gps_speed) != EXPECTED_SPEED_LENGTH
                ):
                    malformed.append(
                        {
                            "event_id": event_id,
                            "label": label,
                            "gsensor_len": len(gsensor),
                            "gyro_len": len(gyro),
                            "speed_len": len(gps_speed),
                        }
                    )

                # Check NaN / Infinity
                if (
                    not np.isfinite(gsensor).all()
                    or not np.isfinite(gyro).all()
                    or not np.isfinite(gps_speed).all()
                ):
                    invalid_values.append(event_id)

                fingerprint = sensor_hash(
                    gsensor,
                    gyro,
                    gps_speed,
                )

                if fingerprint not in hashes:
                    hashes[fingerprint] = []

                hashes[fingerprint].append(
                    (event_id, label)
                )

                if total % 10000 == 0:
                    print(
                        f"Processed {total:,} "
                        f"{split_name} events..."
                    )

    duplicate_groups = {
        fingerprint: events
        for fingerprint, events in hashes.items()
        if len(events) > 1
    }

    print(f"\n{split_name.upper()} SUMMARY")
    print("-" * 40)
    print(f"Events: {total:,}")
    print(f"Unique sensor hashes: {len(hashes):,}")
    print(
        "Duplicate sensor groups inside split:",
        len(duplicate_groups),
    )
    print("Malformed events:", len(malformed))
    print(
        "Events containing NaN/Infinity:",
        len(invalid_values),
    )

    return {
        "hashes": hashes,
        "duplicates": duplicate_groups,
        "malformed": malformed,
        "invalid": invalid_values,
    }


results = {}

for split in ["train", "validation", "test"]:
    results[split] = audit_split(split)


print("\n===================================")
print("CROSS-SPLIT SENSOR DUPLICATES")
print("===================================")

train_hashes = set(results["train"]["hashes"])
validation_hashes = set(results["validation"]["hashes"])
test_hashes = set(results["test"]["hashes"])


train_validation = train_hashes & validation_hashes
train_test = train_hashes & test_hashes
validation_test = validation_hashes & test_hashes


print(
    "Train <-> Validation identical recordings:",
    len(train_validation),
)

print(
    "Train <-> Test identical recordings:",
    len(train_test),
)

print(
    "Validation <-> Test identical recordings:",
    len(validation_test),
)


def print_examples(name, shared_hashes, split_a, split_b):
    if not shared_hashes:
        return

    print(f"\nExamples from {name}:")

    for fingerprint in list(shared_hashes)[:10]:

        print("\nHash:", fingerprint)

        print(
            split_a,
            results[split_a]["hashes"][fingerprint],
        )

        print(
            split_b,
            results[split_b]["hashes"][fingerprint],
        )


print_examples(
    "Train / Validation",
    train_validation,
    "train",
    "validation",
)

print_examples(
    "Train / Test",
    train_test,
    "train",
    "test",
)

print_examples(
    "Validation / Test",
    validation_test,
    "validation",
    "test",
)


total_cross_split_duplicates = (
    len(train_validation)
    + len(train_test)
    + len(validation_test)
)

total_malformed = sum(
    len(results[split]["malformed"])
    for split in results
)

total_invalid = sum(
    len(results[split]["invalid"])
    for split in results
)


print("\n===================================")
print("FINAL RESULT")
print("===================================")

if (
    total_cross_split_duplicates == 0
    and total_malformed == 0
    and total_invalid == 0
):
    print("Sensor-level integrity check: PASSED")
else:
    print("WARNING: Dataset integrity issues detected.")
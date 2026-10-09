# Crash Detection AI Model

AI component of the Crash Response Platform graduation project.

## Overview

This module detects vehicle crashes using accelerometer, gyroscope, and GPS speed data.

The current completed version is **Random Forest V1**, a binary classifier:

- Crash -> 1
- Near Miss -> 0
- Normal Driving -> 0

The model is currently developed and evaluated using the VZCrash dataset.

## Dataset

Dataset:

`vzc-research-chapter/VZCrash`

The full dataset is stored locally and is not committed to Git.

Expected local location:

`data/VZCrash/data/`

Original dataset size:

| Split | Events |
| --- | ---: |
| Train | 137,954 |
| Validation | 27,175 |
| Test | 24,174 |
| Total | 189,303 |

## Dataset Integrity Audit

Before model training, the official VZCrash splits were audited.

The audit checked:

- Duplicate event IDs
- Event ID overlap between splits
- Sensor sequence lengths
- NaN and infinite values
- Exact duplicate sensor recordings
- Duplicate recordings across train, validation, and test

No event ID overlap was found between the official splits.

However, exact duplicate sensor recordings were found under different event IDs, including duplicates across official dataset splits.

A complete sensor recording hash was generated from:

`gsensor + gyro + gps_speed`

To prevent identical sensor recordings from appearing in multiple model-development splits, a deterministic cleaning policy was applied.

Priority:

`Test > Validation > Train`

If the same sensor recording appeared multiple times:

1. Test was preserved over validation or train.
2. Validation was preserved over train.
3. Within a single split, only one copy was retained.

The original Parquet files were never modified.

A clean manifest is generated locally by:

`scripts/build_vzcrash_clean_manifest.py`

After deduplication:

| Split | Clean Events |
| --- | ---: |
| Train | 137,554 |
| Validation | 27,145 |
| Test | 24,167 |
| Total | 188,866 |

## Feature Extraction

Each event is converted from raw sensor sequences into 11 physical summary features.

### Accelerometer

- `accel_max`
- `accel_mean`
- `accel_std`

### Gyroscope

- `gyro_max`
- `gyro_mean`
- `gyro_std`

### GPS Speed

- `speed_start`
- `speed_end`
- `speed_max`
- `speed_min`
- `speed_drop`

Accelerometer and gyroscope X/Y/Z readings are first converted to vector magnitude.

Metadata such as event ID, vehicle size, sensor sequence length, and `gyro_is_hd` is not used as input to Random Forest V1.

## Rule-Based Baseline

The initial baseline predicts a crash when:

`accel_max >= 2.0 g`

This baseline was retained as a reference for evaluating whether machine learning improves crash detection.

## Random Forest V1

Model:

`RandomForestClassifier`

Configuration:

```python
RandomForestClassifier(
    n_estimators=300,
    class_weight="balanced_subsample",
    random_state=42,
    n_jobs=-1,
)
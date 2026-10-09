import pandas as pd
import matplotlib.pyplot as plt


DATA_PATH = "data/eda_features_3000.csv"

CLASS_ORDER = [
    "Crash",
    "Near Miss",
    "Normal Driving",
]

FEATURES = {
    "accel_max": "Maximum Acceleration Magnitude (g)",
    "accel_std": "Acceleration Standard Deviation",
    "gyro_max": "Maximum Gyroscope Magnitude (deg/s)",
    "gyro_std": "Gyroscope Standard Deviation",
    "speed_drop": "Speed Drop (km/h)",
}


print("Loading local EDA features...")

df = pd.read_csv(DATA_PATH)

print(f"Loaded {len(df)} events.")


for feature, title in FEATURES.items():

    values = [
        df[df["class"] == class_name][feature]
        for class_name in CLASS_ORDER
    ]

    plt.figure(figsize=(9, 6))

    plt.boxplot(
        values,
        tick_labels=CLASS_ORDER,
        showfliers=False,
    )

    plt.title(title)
    plt.ylabel(title)
    plt.xlabel("Event Class")

    plt.tight_layout()


print("\n===================================")
print("FEATURE QUANTILES BY CLASS")
print("===================================")

for feature in FEATURES:

    print(f"\n{feature}")

    table = (
        df.groupby("class")[feature]
        .quantile([0.25, 0.50, 0.75, 0.90])
        .unstack()
        .round(2)
    )

    table.columns = [
        "25%",
        "Median",
        "75%",
        "90%",
    ]

    print(table)


plt.show()
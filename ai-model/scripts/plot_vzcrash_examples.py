from datasets import load_dataset
import numpy as np
import matplotlib.pyplot as plt


DATASET_NAME = "vzc-research-chapter/VZCrash"

# The examples we found in our inspection
TARGET_EVENTS = {
    9366: "Crash",
    19241: "Near Miss",
    9322: "Normal Driving",
}


print("Loading VZCrash...")

dataset = load_dataset(
    DATASET_NAME,
    split="train",
    streaming=True,
)


events = {}

for event in dataset:
    event_id = event["event_id"]

    if event_id in TARGET_EVENTS:
        events[event_id] = event
        print(
            f"Found {TARGET_EVENTS[event_id]} "
            f"(event {event_id})"
        )

    if len(events) == len(TARGET_EVENTS):
        break


for event_id, name in TARGET_EVENTS.items():

    event = events[event_id]

    # Convert Python lists to NumPy arrays
    gsensor = np.array(event["gsensor"])
    gyro = np.array(event["gyro"])
    speed = np.array(event["gps_speed"])

    # Calculate magnitude of the 3 axes
    accel_magnitude = np.linalg.norm(gsensor, axis=1)
    gyro_magnitude = np.linalg.norm(gyro, axis=1)

    # Time axes
    sensor_time = np.arange(len(gsensor)) / 100
    speed_time = np.arange(len(speed))

    # Create one figure for this event
    fig, axes = plt.subplots(3, 1, figsize=(12, 8))

    fig.suptitle(
        f"{name} - Event {event_id}"
    )

    # Acceleration
    axes[0].plot(sensor_time, accel_magnitude)
    axes[0].set_ylabel("Acceleration Magnitude")
    axes[0].set_title("Accelerometer")

    # Gyroscope
    axes[1].plot(sensor_time, gyro_magnitude)
    axes[1].set_ylabel("Gyroscope Magnitude")
    axes[1].set_title("Gyroscope")

    # Speed
    axes[2].plot(speed_time, speed, marker="o")
    axes[2].set_ylabel("Speed")
    axes[2].set_xlabel("Time (seconds)")
    axes[2].set_title("GPS Speed")

    plt.tight_layout()

plt.show()
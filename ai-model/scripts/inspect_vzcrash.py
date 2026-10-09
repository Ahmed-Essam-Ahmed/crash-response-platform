from datasets import load_dataset

DATASET_NAME = "vzc-research-chapter/VZCrash"

print("Loading VZCrash in streaming mode...")

dataset = load_dataset(
    DATASET_NAME,
    split="train",
    streaming=True,
)

label_counts = {
    0: 0,
    1: 0,
    2: 0,
}

examples = {}

for event in dataset:
    label = event["label"]

    if label in label_counts:
        label_counts[label] += 1

        if label not in examples:
            examples[label] = event

    if len(examples) == 3:
        break

print("\nFound one example for every label.")

for label, event in examples.items():
    print("\n-------------------------")
    print("Label:", label)
    print("Event ID:", event["event_id"])
    print("Vehicle size:", event["vehiclesize"])
    print("G-sensor samples:", len(event["gsensor"]))
    print("Gyroscope samples:", len(event["gyro"]))
    print("GPS speed samples:", len(event["gps_speed"]))

print("\nExamples scanned by label:")
print(label_counts)
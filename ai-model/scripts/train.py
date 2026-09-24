#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from detection.ml_model import CrashClassifier

WINDOW = 40


def _windows(samples):
    for i in range(0, len(samples) - WINDOW, WINDOW):
        yield samples[i:i + WINDOW]


def _features(samples):
    w = next(_windows(samples))
    peak = max(s["accel"]["g"] for s in w)
    dv = w[0]["gps"]["speed_mps"] - w[-1]["gps"]["speed_mps"]
    tail = w[-(max(1, int(3.0 / (w[1]["t"] - w[0]["t"])))):]
    inactive = all(s["gps"]["speed_mps"] < 0.5 for s in tail)
    return [peak, dv, inactive and 1 or 0]


def main():
    parser = argparse.ArgumentParser(description="Train the crash vs near-miss veto classifier")
    parser.add_argument("--scenario", required=True, help="Labeled scenario JSON")
    args = parser.parse_args()

    scenario = json.loads(Path(args.scenario).read_text())
    X, y = [], []
    for trip in scenario["trips"]:
        label = trip.get("label", "normal")
        if label not in ("crash", "near_miss"):
            continue
        for _ in range(20):
            X.append(_features(trip["samples"]))
            y.append(1 if label == "crash" else 0)

    clf = CrashClassifier().fit(X, y)
    clf.save()
    print(json.dumps({"trained": clf.path, "samples": len(X),
                      "positives": y.count(1), "negatives": y.count(0)}, indent=2))


if __name__ == "__main__":
    main()
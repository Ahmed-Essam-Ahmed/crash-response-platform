#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from simulator.scenario import build_demo_scenario


def main():
    parser = argparse.ArgumentParser(description="Generate a labeled sensor scenario")
    parser.add_argument("--out", default="data/sample_scenario.json", help="Output JSON path")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    scenario = build_demo_scenario()
    with open(out_path, "w") as fh:
        json.dump(scenario, fh, indent=2)

    summary = {t["trip_id"]: t["label"] for t in scenario["trips"]}
    print(json.dumps({"written": str(out_path), "trips": summary}, indent=2))


if __name__ == "__main__":
    main()
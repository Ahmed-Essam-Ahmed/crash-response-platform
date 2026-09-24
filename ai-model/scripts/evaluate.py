#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from detection.pipeline import DetectionPipeline


def main():
    parser = argparse.ArgumentParser(description="Evaluate detection pipeline on a scenario")
    parser.add_argument("--scenario", required=True, help="Labeled scenario JSON")
    parser.add_argument("--medical-risk", type=float, default=0.0)
    args = parser.parse_args()

    scenario = json.loads(Path(args.scenario).read_text())
    detections = DetectionPipeline().process_scenario(scenario, medical_risk=args.medical_risk)
    print(json.dumps(detections, indent=2))


if __name__ == "__main__":
    main()
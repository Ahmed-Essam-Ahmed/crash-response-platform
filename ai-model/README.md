# Part 3 — AI Model (Detection & Severity)

Hybrid crash-detection pipeline and the AI severity rater. Consumes `sensor_sample` windows (from
`simulation`) and produces `crash_detected` events (see [`contracts/`](../contracts)).

## Ownership

Team member 3. The Python package is named `detection/` (its function); the part is `ai-model/`.

## Responsibilities

- **Threshold rules** — peak g-force and delta-V thresholds flag a candidate impact.
- **ML veto classifier** — decides crash vs. near-miss (hard braking, sharp turn, pothole) to kill
  false positives. Trained on labeled simulated scenarios.
- **Severity rating (0–10)** — weighted model over impact g-force, delta-V, impact type, speed at
  impact, post-crash inactivity, and medical context; optional ML regression refinement.

## Run

```bash
pip install -r requirements.txt
# 1) train the ML veto classifier on labeled scenarios
python scripts/train.py --scenario ../simulation/data/sample_scenario.json
# 2) run the full pipeline on a scenario
python scripts/evaluate.py --scenario ../simulation/data/sample_scenario.json
```

## Layout

```
detection/
  rules.py      # threshold detection (g, delta-V)
  severity.py   # 0–10 scoring model
  ml_model.py   # sklearn veto classifier wrapper
  pipeline.py   # window buffer → rules → ML veto → severity → crash_detected
scripts/
  train.py
  evaluate.py
tests/
  test_rules.py
```
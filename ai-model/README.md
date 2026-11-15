# Part 3 — AI Model (Detection & Severity)

Hybrid crash-detection pipeline and the AI severity rater. Consumes `sensor_sample` windows captured
by the mobile-app (device sensors or a replayed recording) and produces `crash_detected` events (see
[`contracts/`](../contracts)). In the connected system it runs as a standalone HTTP service exposing
`POST /detect` — see [`docs/integration.md`](../docs/integration.md).

## Ownership

Team member 3. The Python package is named `detection/` (its function); the part is `ai-model/`.

## Responsibilities

- **Threshold rules** — peak g-force and delta-V thresholds flag a candidate impact.
- **ML veto classifier** — decides crash vs. near-miss (hard braking, sharp turn, pothole) to kill
  false positives. Trained on labeled recorded trips.
- **Severity rating (0–10)** — weighted model over impact g-force, delta-V, impact type, speed at
  impact, post-crash inactivity, and medical context; optional ML regression refinement.

## Run

```bash
pip install -r requirements.txt
# 1) train the ML veto classifier on a labeled recorded trip
python scripts/train.py --scenario ../mobile-app/assets/scenario.json
# 2) run the full pipeline on a recorded trip
python scripts/evaluate.py --scenario ../mobile-app/assets/scenario.json
```

Captured trips are arrays of `sensor_sample`s (see [`contracts/`](../contracts)); the demo trip in
`mobile-app/assets/scenario.json` is a ready-to-use example.

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
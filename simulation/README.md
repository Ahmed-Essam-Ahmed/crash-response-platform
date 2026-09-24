# Part 4 — Simulation

Generates the data that replaces real hardware: phone sensor streams (accelerometer, gyroscope,
GPS), trips with realistic speed profiles, contextual factors (weather, time of day), labeled
crash signatures based on published crash-test deceleration curves, and the live world simulator.

## Ownership

Team member 4. Everything downstream consumes this part's output as JSON (see
[`contracts/`](../contracts)).

## Responsibilities

- Build a road graph and trip generator (lat/lon + speed over time).
- Emit normal driving with realistic noise, including near-miss events (hard braking, sharp turns).
- Inject a labeled crash: impact spike (g), delta-V drop, post-crash inactivity.
- Attach context (hour, weather, road type) to each trip.

## Run

```bash
pip install -r requirements.txt
python scripts/generate_sample.py --out data/sample_scenario.json
```

Produces a deterministic scenario with `trip-0001` crashing at `t≈124s` plus two near-miss trips.

## Layout

```
simulator/
  trips.py      # road graph, trip generation, speed profiles
  sensors.py    # accelerometer/gyroscope/GPS sampling with noise
  crash.py      # crash signature generator (g spike + delta-V)
  scenario.py   # orchestrates a full labeled scenario + context
world/
  grid.py       # small city road grid (intersections + edges)
  world.py      # live world: driving vehicles, hospitals, crash scheduling
scripts/
  generate_sample.py  # CLI entry point (offline labeled scenario)
tests/
  test_trips.py
```

The output schema matches `contracts` (`sensor_sample`, `vehicle_state`).

## Live world simulator

`world/` powers the game-like demo. It runs a small grid city with vehicles driving the roads and
three hospitals, and schedules crashes:

- **scripted** — one guaranteed crash every loop (deterministic demo).
- **random** — crashes happen probabilistically while traffic keeps circulating (builds analytics data).

The backend drives it (see [`../hospital-website/backend`](../hospital-website/backend)): it ticks
the world, feeds crash windows to `ai-model`, and publishes real alerts. You can also run it
standalone for experiments:

```bash
python -c "from world.world import World; w=World('random'); [print(e['type']) for _ in range(50) for e in w.tick(0.1)]"
```
import random

from .grid import CityGrid

DT = 0.1


class Vehicle:
    def __init__(self, trip_id, a, b, progress, speed):
        self.trip_id = trip_id
        self.a = a
        self.b = b
        self.progress = progress
        self.speed = speed
        self.status = "driving"


class World:
    def __init__(self, mode="scripted", seed=7, vehicles=10):
        self.grid = CityGrid()
        self.mode = mode
        self.rng = random.Random(seed)
        self.vehicles = []
        self.hospitals = self._hospitals()
        self.time = 0.0
        self.next_id = 0
        self.script_reset_at = None
        self.script_crash_time = 10.0
        self.script_crashed = False
        self._spawn(start=vehicles)

    def _hospitals(self, codes=("hosp-01", "hosp-02", "hosp-03")):
        rows = self.grid.rows
        cols = self.grid.cols
        idx = [0, 2 * cols + 2, 4 * cols + 5]
        out = []
        for i, code in zip(idx, codes):
            n = self.grid.nodes[i]
            out.append({"code": code, "lat": n.lat, "lon": n.lon})
        return out

    def _spawn(self, start=2):
        for _ in range(start):
            self._add_vehicle()

    def _add_vehicle(self):
        a = self.grid.random_intersection(self.rng)
        b = self.rng.choice(self.grid.neighbors[a])
        speed = self.rng.uniform(8.0, 15.0)
        v = Vehicle(f"veh-{self.next_id:03d}", a, b, self.rng.random(), speed)
        self.next_id += 1
        self.vehicles.append(v)
        return v

    def reset(self, start=2):
        self.vehicles.clear()
        self.time = 0.0
        self.script_crashed = False
        self._spawn(start=start)

    def tick(self, dt=DT):
        self.time += dt
        events = []
        for v in list(self.vehicles):
            if v.status == "crashed":
                continue
            self._move(v, dt)
            lat, lon = self.grid.position(v.a, v.b, v.progress)
            events.append({"type": "vehicle_state", "trip_id": v.trip_id,
                           "lat": lat, "lon": lon, "speed_mps": round(v.speed, 2),
                           "status": v.status})
            crash = self._maybe_crash(v, lat, lon)
            if crash:
                events.append(crash)
        if self.mode == "scripted" and not self.script_crashed and self.time >= self.script_crash_time:
            hero = self.vehicles[0]
            lat, lon = self.grid.position(hero.a, hero.b, hero.progress)
            crash = self._make_crash(hero, lat, lon, severity=6.5)
            if crash:
                events.append(crash)
        return events

    def _move(self, v, dt):
        edge_len = self.grid.edge_len[(v.a, v.b)]
        v.progress += (v.speed * dt) / max(edge_len, 1.0)
        if v.progress >= 1.0:
            v.progress = 0.0
            v.a, v.b = v.b, self.grid.pick_next(v.b, v.a)

    def _maybe_crash(self, v, lat, lon):
        if self.mode != "random":
            return None
        if self.rng.random() < 0.0008:
            severity = round(self.rng.uniform(4.0, 9.5), 1)
            return self._make_crash(v, lat, lon, severity)
        return None

    def _make_crash(self, v, lat, lon, severity):
        window = self._crash_window(v, lat, lon, severity)
        if window is None:
            return None
        v.status = "crashed"
        loc = {"lat": round(lat, 6), "lon": round(lon, 6)}
        if self.mode == "scripted":
            self.script_crashed = True
        elif self.mode == "random":
            self.vehicles.remove(v)
            self._add_vehicle()
        return {"type": "world_crash", "trip_id": v.trip_id, "location": loc,
                "speed_mps": v.speed, "severity": severity, "window": window}

    def _crash_window(self, v, lat, lon, severity):
        from simulator.crash import crash_signature

        dt = DT
        sig, _ = crash_signature(v.speed, severity, dt=dt)
        samples = []
        t = 0.0
        for s in sig:
            speed = s["speed_mps"]
            g = s["g"]
            samples.append({
                "t": round(t, 3),
                "trip_id": v.trip_id,
                "gps": {"lat": round(lat, 6), "lon": round(lon, 6),
                        "speed_mps": round(speed, 2)},
                "accel": {"g": round(g, 2), "x": round(-g, 2), "y": 0.0, "z": 1.0},
            })
            t += dt
        return samples
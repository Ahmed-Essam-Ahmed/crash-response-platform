from .crash import crash_signature, near_miss_brake
from .sensors import sample_accel_g, sample_gps, sample_gyro_rps
from .trips import cruise_with_turn

SCHEMA_VERSION = "1.0"
SAMPLE_RATE_HZ = 10


def build_trip(trip_id: str, start_lat: float, start_lon: float, hours: float,
               weather: str, road: str, crash_at_s: float = None, severity: float = 5.0,
               near_miss_at_s: float = None, speed_mps: float = 14.0, duration_s: float = 160.0):
    dt = 1.0 / SAMPLE_RATE_HZ
    route = cruise_with_turn(start_lat, start_lon, speed_mps, duration_s,
                             turn_at_s=duration_s * 0.4, turn_deg=20.0, dt=dt)
    samples = []
    seq = 0
    impact_meta = None
    post_crash_g = 0.0
    for p in route:
        extra_g = 0.0
        speed = p["speed_mps"]
        if crash_at_s is not None and crash_at_s <= p["t"] < crash_at_s + 3.4:
            idx = int((p["t"] - crash_at_s) / dt)
            sig, meta = crash_signature(speed, severity, dt=dt)
            if idx < len(sig):
                extra_g = sig[idx]["g"]
                speed = sig[idx]["speed_mps"]
            impact_meta = impact_meta or meta
        elif crash_at_s is not None and p["t"] >= crash_at_s + 3.4:
            speed = 0.0
        elif near_miss_at_s is not None and near_miss_at_s <= p["t"] < near_miss_at_s + 1.5:
            idx = int((p["t"] - near_miss_at_s) / dt)
            nm = near_miss_brake(speed, dt=dt)
            if idx < len(nm):
                extra_g = nm[idx]["g"]
        lat, lon = sample_gps(p["lat"], p["lon"])
        lateral = 0.3 * (1 if 90 <= (p["t"] % 40) < 94 else -0.2 if p["t"] % 40 >= 94 else 0.0)
        accel = sample_accel_g(extra_g * 9.81, lateral, 0.0)
        samples.append({
            "schema_version": SCHEMA_VERSION,
            "type": "sensor_sample",
            "t": round(p["t"], 3),
            "trip_id": trip_id,
            "seq": seq,
            "gps": {"lat": lat, "lon": lon, "speed_mps": round(speed, 3)},
            "accel": accel,
            "gyro": sample_gyro_rps(),
            "context": {"hour": int(hours), "weather": weather, "road": road},
        })
        seq += 1
    return {
        "trip_id": trip_id,
        "dt": dt,
        "crash": {"time_s": crash_at_s, "severity": severity,
                  "impact_factors": impact_meta} if crash_at_s is not None else None,
        "label": "crash" if crash_at_s is not None else "near_miss" if near_miss_at_s is not None else "normal",
        "samples": samples,
    }


def build_demo_scenario():
    trips = [
        build_trip("trip-0001", 30.04442, 31.23571, hours=14, weather="clear", road="urban",
                   crash_at_s=124.0, severity=7.0, speed_mps=16.0),
        build_trip("trip-0002", 30.05500, 31.24500, hours=9, weather="rain", road="highway",
                   near_miss_at_s=60.0, speed_mps=22.0),
        build_trip("trip-0003", 30.03200, 31.22500, hours=18, weather="fog", road="rural",
                   near_miss_at_s=40.0, speed_mps=18.0),
    ]
    return {"schema_version": SCHEMA_VERSION, "trips": trips}
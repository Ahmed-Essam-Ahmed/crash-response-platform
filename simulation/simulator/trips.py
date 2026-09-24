import math
from dataclasses import dataclass, field


@dataclass
class RoadNode:
    lat: float
    lon: float


@dataclass
class Trip:
    trip_id: str
    start_lat: float
    start_lon: float
    dt: float = 0.1
    points: list = field(default_factory=list)


def _advance(lat: float, lon: float, bearing: float, dist_m: float) -> tuple:
    r_earth = 6371000.0
    d_lat = dist_m * math.cos(bearing) / r_earth
    d_lon = dist_m * math.sin(bearing) / (r_earth * math.cos(math.radians(lat)))
    return lat + math.degrees(d_lat), lon + math.degrees(d_lon)


def straight_line(start_lat: float, start_lon: float, heading_deg: float,
                  speed_mps: float, duration_s: float, dt: float) -> list:
    bearing = math.radians(heading_deg)
    dist = speed_mps * dt
    points = []
    lat, lon = start_lat, start_lon
    t = 0.0
    while t <= duration_s:
        points.append({"t": round(t, 3), "lat": lat, "lon": lon, "speed_mps": round(speed_mps, 3)})
        lat, lon = _advance(lat, lon, bearing, dist)
        t += dt
    return points


def cruise_with_turn(start_lat: float, start_lon: float, speed_mps: float,
                     duration_s: float, turn_at_s: float, turn_deg: float, dt: float) -> list:
    heading = 0.0
    points = []
    lat, lon = start_lat, start_lon
    t = 0.0
    while t <= duration_s:
        point_speed = min(speed_mps, 0.6 * speed_mps + 0.4 * speed_mps * abs(math.sin(math.radians(t * 2))))
        points.append({"t": round(t, 3), "lat": round(lat, 6),
                       "lon": round(lon, 6), "speed_mps": round(point_speed, 3)})
        if t >= turn_at_s:
            heading += math.radians(turn_deg * dt / 2.0)
        lat, lon = _advance(lat, lon, heading, point_speed * dt)
        t += dt
    return points
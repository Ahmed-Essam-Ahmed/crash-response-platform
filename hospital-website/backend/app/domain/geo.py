import math

EARTH_RADIUS_M = 6371000.0
AMBULANCE_SPEED_MPS = 11.0
LOAD_SPEED_MPS = 8.0


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def eta_seconds(distance_m: float, speed_mps: float = AMBULANCE_SPEED_MPS) -> int:
    if speed_mps <= 0:
        speed_mps = AMBULANCE_SPEED_MPS
    return max(1, int(round(distance_m / speed_mps)))


def bearing_deg(lat1, lon1, lat2, lon2) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def interpolate(lat1, lon1, lat2, lon2, progress: float) -> dict:
    p = min(1.0, max(0.0, progress))
    return {"lat": lat1 + (lat2 - lat1) * p, "lon": lon1 + (lon2 - lon1) * p}


def corridor(lat1, lon1, lat2, lon2, steps: int = 6) -> list:
    return [interpolate(lat1, lon1, lat2, lon2, i / (steps - 1)) for i in range(steps)]

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


def straight_route(lat1, lon1, lat2, lon2) -> list:
    return [{"lat": lat1, "lon": lon1}, {"lat": lat2, "lon": lon2}]


def polyline_length(points: list) -> float:
    total = 0.0
    for index in range(1, len(points)):
        total += haversine_m(
            points[index - 1]["lat"], points[index - 1]["lon"],
            points[index]["lat"], points[index]["lon"],
        )
    return total


def position_along(points: list, progress: float) -> dict:
    """Point at a fraction of the way along a path, measured by distance."""
    if not points:
        raise ValueError("position_along needs at least one point")
    if len(points) == 1:
        return dict(points[0])
    p = min(1.0, max(0.0, progress))
    target = polyline_length(points) * p
    walked = 0.0
    for index in range(1, len(points)):
        start, end = points[index - 1], points[index]
        leg = haversine_m(start["lat"], start["lon"], end["lat"], end["lon"])
        if leg <= 0.0:
            continue
        if walked + leg >= target:
            return interpolate(start["lat"], start["lon"], end["lat"], end["lon"], (target - walked) / leg)
        walked += leg
    return dict(points[-1])


def simplify(points: list, tolerance_m: float = 8.0) -> list:
    """Drop points closer together than the tolerance, keeping the ends."""
    if len(points) < 3:
        return list(points)
    kept = [points[0]]
    for point in points[1:-1]:
        last = kept[-1]
        if haversine_m(last["lat"], last["lon"], point["lat"], point["lon"]) >= tolerance_m:
            kept.append(point)
    kept.append(points[-1])
    return kept


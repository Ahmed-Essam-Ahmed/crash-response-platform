import json
import urllib.parse
import urllib.request

from ..config import ROAD_ROUTER_ENABLED, ROAD_ROUTER_TIMEOUT, ROAD_ROUTER_URL
from ..domain import geo

USER_AGENT = "crash-response-platform/3.0 (ambulance routing)"

_CACHE: dict[tuple, list] = {}
_CACHE_LIMIT = 512


def _key(lat1, lon1, lat2, lon2) -> tuple:
    return (round(lat1, 4), round(lon1, 4), round(lat2, 4), round(lon2, 4))


def _fetch(lat1, lon1, lat2, lon2) -> list | None:
    coordinates = f"{lon1},{lat1};{lon2},{lat2}"
    url = f"{ROAD_ROUTER_URL}/{coordinates}?" + urllib.parse.urlencode(
        {"overview": "full", "geometries": "geojson"}
    )
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=ROAD_ROUTER_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    if data.get("code") != "Ok" or not data.get("routes"):
        return None

    raw = data["routes"][0].get("geometry", {}).get("coordinates") or []
    points = [{"lat": round(float(lat), 6), "lon": round(float(lon), 6)} for lon, lat in raw]
    if len(points) < 2:
        return None
    return points


def road_route(lat1, lon1, lat2, lon2) -> list:
    """The real drivable path between two points, or the straight line if unknown.

    A route that is not available must not be able to stop a case from being
    dispatched, so every failure path lands on the fallback rather than raising.
    """
    fallback = geo.straight_route(lat1, lon1, lat2, lon2)
    if not ROAD_ROUTER_ENABLED:
        return fallback

    key = _key(lat1, lon1, lat2, lon2)
    if key in _CACHE:
        return _CACHE[key]

    try:
        points = _fetch(lat1, lon1, lat2, lon2)
    except Exception:
        points = None

    if not points:
        return fallback

    points = geo.simplify(points)
    if len(_CACHE) >= _CACHE_LIMIT:
        _CACHE.clear()
    _CACHE[key] = points
    return points


def routes_for_incident(hospital_lat, hospital_lon, crash_lat, crash_lon) -> dict:
    return {
        "outbound": road_route(hospital_lat, hospital_lon, crash_lat, crash_lon),
        "inbound": road_route(crash_lat, crash_lon, hospital_lat, hospital_lon),
    }


def clear_cache() -> None:
    _CACHE.clear()

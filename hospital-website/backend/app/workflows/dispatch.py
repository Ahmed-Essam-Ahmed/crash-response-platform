import math
import uuid

from .. import models
from ..db import SessionLocal


def haversine_m(a_lat, a_lon, b_lat, b_lon):
    r = 6371000.0
    phi1, phi2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dlmb = math.radians(b_lon - a_lon)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def dispatch_ambulance(db, hospital: dict, location: dict):
    candidates = db.query(models.Hospital).all()
    base = min(
        candidates,
        key=lambda h: haversine_m(h.lat, h.lon, location["lat"], location["lon"]),
        default=None,
    )
    if base is None:
        base = models.Hospital(code="hosp-01", lat=location["lat"], lon=location["lon"])
    dist_m = haversine_m(base.lat, base.lon, location["lat"], location["lon"])
    eta_seconds = max(60, int(dist_m / 8.0))
    return {
        "ambulance_id": f"amb-{uuid.uuid4().hex[:6]}",
        "hospital_code": base.code,
        "eta_seconds": eta_seconds,
        "route": [{"lat": base.lat, "lon": base.lon}, {"lat": location["lat"], "lon": location["lon"]}],
    }
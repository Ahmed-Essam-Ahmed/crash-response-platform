import math

from .. import models


def _haversine_m(a_lat, a_lon, b_lat, b_lon):
    r = 6371000.0
    dlat = math.radians(b_lat - a_lat)
    dlon = math.radians(b_lon - a_lon)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a_lat)) * \
        math.cos(math.radians(b_lat)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def assign_hospital(db, location: dict):
    hospitals = db.query(models.Hospital).all()
    if not hospitals:
        hospitals = [
            models.Hospital(code="hosp-01", lat=30.03, lon=31.24, capacity=5),
            models.Hospital(code="hosp-02", lat=30.05, lon=31.22, capacity=6),
            models.Hospital(code="hosp-03", lat=30.06, lon=31.26, capacity=4),
        ]
        db.add_all(hospitals)
        db.commit()

    available = [h for h in hospitals if h.load < h.capacity]
    pool = available or hospitals
    best = min(pool, key=lambda h: _haversine_m(h.lat, h.lon,
                                                location["lat"], location["lon"]))
    best.load += 1
    db.commit()
    return {"code": best.code, "lat": best.lat, "lon": best.lon, "load": best.load}
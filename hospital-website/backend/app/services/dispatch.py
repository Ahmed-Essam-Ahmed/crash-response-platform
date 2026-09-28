from .. import models
from ..domain import geo, triage


class NoResource(Exception):
    def __init__(self, message):
        super().__init__(message)


def select_hospital(db, destination, location: dict):
    hospitals = db.query(models.Hospital).all()
    if not hospitals:
        raise NoResource("no hospitals registered")

    eligible = [h for h in hospitals if triage.accepts(h.trauma_level, destination)]
    if not eligible:
        raise NoResource(f"no hospital accepts {destination.value}")

    with_beds = [h for h in eligible if h.free_beds > 0]
    pool = with_beds or eligible
    return min(pool, key=lambda h: geo.haversine_m(h.lat, h.lon, location["lat"], location["lon"]))


def select_ambulances(db, hospital, location: dict, count: int):
    fleet = [a for a in db.query(models.Ambulance).all() if a.is_available]
    if not fleet:
        raise NoResource("no ambulance available")

    ranked = sorted(
        fleet,
        key=lambda a: geo.haversine_m(a.lat, a.lon, location["lat"], location["lon"]),
    )
    return ranked[:count]


def reserve(db, hospital, ambulances) -> None:
    hospital.current_load += 1
    for amb in ambulances:
        amb.status = "assigned"
    db.commit()


def release(db, incident) -> None:
    for amb in incident.ambulances:
        amb.status = "available"
        amb.incident_id = None
    hospital = incident.hospital
    if hospital is not None:
        hospital.current_load = max(0, hospital.current_load - 1)
    db.commit()

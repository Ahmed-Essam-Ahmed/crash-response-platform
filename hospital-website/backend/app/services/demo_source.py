import asyncio
import random
from types import SimpleNamespace

from .. import models
from ..config import DEMO_SOURCE
from ..db import SessionLocal
from . import egypt, intake, offers

INTERVAL_SECONDS = 8.0
AUTO_ACCEPT_RADIUS_M = 160_000
AUTO_ACCEPT_CHANCE = 0.9
DEMO_DISPATCHER = SimpleNamespace(email="dispatch@national-demo")

NAMES = ["Mona Khalil", "Youssef Adel", "Salma Fathy", "Omar Nabil", "Hana Rami", "Karim Fouad"]
BLOOD = ["O+", "A+", "B+", "AB+", "O-", "A-"]
CONDITIONS = ["diabetes", "asthma", "hypertension", "none", "none", "none"]
MEDICATIONS = ["metformin", "salbutamol", "amlodipine", "none", "none"]
SUMMARY = {
    "frontal": "Frontal impact, likely chest and head trauma",
    "side": "Side impact, possible rib and pelvis injuries",
    "rear": "Rear impact, neck strain and whiplash likely",
    "rollover": "Rollover, multiple blunt injuries expected",
}


def _random_case() -> dict:
    cluster = egypt.choose_cluster()
    lat, lon = egypt.random_point(cluster)
    severity = round(min(9.9, max(1.0, random.gauss(cluster["severity"], 1.4))), 1)
    impact_type = random.choice(list(SUMMARY))
    destination = "trauma_centre" if severity >= 8 else ("major" if severity >= 5.5 else "minor")
    return {
        "trip_id": f"demo-{random.randint(1000, 9999)}",
        "severity": severity,
        "severity_source": "ai",
        "severity_confidence": round(random.uniform(0.8, 0.99), 2),
        "severity_summary": SUMMARY[impact_type],
        "governorate": cluster["governorate"],
        "location": {
            "lat": lat,
            "lon": lon,
            "governorate": cluster["governorate"],
        },
        "location_label": f"{egypt.random_road(cluster)}, {cluster['city']}",
        "patient": {
            "name": random.choice(NAMES),
            "age": random.randint(18, 72),
            "blood_type": random.choice(BLOOD),
            "gender": random.choice(["female", "male"]),
            "conditions": [random.choice(CONDITIONS)],
            "medications": [random.choice(MEDICATIONS)],
            "allergies": [random.choice(["penicillin", "none", "none"])],
        },
        "detection": {"rule": True, "ml_confidence": round(random.uniform(0.8, 0.99), 2), "destination": destination},
        "impact_factors": {
            "peak_g": round(3.0 + severity * 0.7, 2),
            "delta_v_mps": round(severity * 1.5, 2),
            "impact_type": impact_type,
        },
    }


def seed_hubs(db) -> int:
    """Create one labelled demo hospital per governorate, idempotently."""
    created = 0
    for hub in egypt.demo_hubs():
        if db.query(models.Hospital).filter(models.Hospital.code == hub["code"]).first():
            continue
        hospital = models.Hospital(
            code=hub["code"],
            name=hub["name"],
            lat=hub["lat"],
            lon=hub["lon"],
            address=hub["address"],
            trauma_level=3,
            ambulances_total=2,
            ambulances_available=2,
            beds_total=40,
            current_load=0,
        )
        db.add(hospital)
        db.flush()
        for unit in range(1, 3):
            db.add(
                models.Ambulance(
                    code=f"{hub['code']}-unit-{unit}",
                    label=f"Unit {unit}",
                    lat=hub["lat"],
                    lon=hub["lon"],
                    status="available",
                    hospital=hospital,
                )
            )
        created += 1
    if created:
        db.commit()
    return created


async def _accept_if_local(db, incident) -> None:
    pending = [offer for offer in incident.offers if offer.status == offers.PENDING]
    if not pending:
        return
    offer = min(pending, key=lambda item: item.distance_m or float("inf"))
    if (offer.distance_m or 0) > AUTO_ACCEPT_RADIUS_M:
        return
    if random.random() > AUTO_ACCEPT_CHANCE:
        return
    await intake.accept_case(db, incident, offer.hospital, DEMO_DISPATCHER)


async def run() -> None:
    while True:
        try:
            db = SessionLocal()
            try:
                incident = await intake.create_case(db, _random_case())
                await _accept_if_local(db, incident)
            finally:
                db.close()
        except Exception as exc:
            print(f"[demo-source] {type(exc).__name__}: {exc}", flush=True)
        await asyncio.sleep(INTERVAL_SECONDS)


def enabled() -> bool:
    return DEMO_SOURCE.lower() in {"on", "1", "true", "yes"}

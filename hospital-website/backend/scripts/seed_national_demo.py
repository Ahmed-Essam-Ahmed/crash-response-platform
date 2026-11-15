"""Seed the demo database with crash history across all Egyptian governorates.

The live demo source creates one case every 12 seconds in a single city, which
makes the national dashboard look like a Cairo-only product. This script keeps
that live feed but backfills a realistic two-year history spread over the 27
governorates, with per-governorate severity profiles and road labels.

Usage (from hospital-website/backend):

    python -m scripts.seed_national_demo --reset --count 12000
"""

import argparse
import json
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, or_, select, update

from app import migrations, models
from app.db import SessionLocal, engine
from app.services import demo_source, egypt

FIRST_NAMES = [
    "Mona", "Youssef", "Salma", "Omar", "Hana", "Karim", "Nour", "Ahmed", "Mariam", "Mahmoud",
    "Rania", "Tarek", "Dina", "Hassan", "Aya", "Khaled", "Sara", "Ali", "Farida", "Mostafa",
]
LAST_NAMES = [
    "Khalil", "Adel", "Fathy", "Nabil", "Rami", "Fouad", "Zaki", "Halim", "Nabil", "Fahmy",
    "Salah", "Hassan", "Ibrahim", "Mansour", "Tawfik", "Sami", "Amin", "Gamal", "Rashad", "Lotfy",
]
BLOOD_TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"]
CONDITIONS = ["diabetes", "asthma", "hypertension", "none", "none", "none", "heart disease"]
MEDICATIONS = ["metformin", "salbutamol", "amlodipine", "none", "none", "insulin"]
ALLERGIES = ["penicillin", "none", "none", "sulfa"]
IMPACT_TYPES = ["frontal", "side", "rear", "rollover", "pedestrian"]
SUMMARIES = {
    "frontal": "Frontal impact, likely chest and head trauma",
    "side": "Side impact, possible rib and pelvis injuries",
    "rear": "Rear impact, neck strain and whiplash likely",
    "rollover": "Rollover, multiple blunt injuries expected",
    "pedestrian": "Pedestrian struck, suspected lower-body trauma",
}
PEAK_HOURS = [7, 8, 9, 10, 16, 17, 18, 19, 20]
DEMO_TRIP_PREFIXES = ("demo-%", "trip-demo-%", "national-demo-%")


def _demo_filter():
    return or_(*[models.Incident.trip_id.like(prefix) for prefix in DEMO_TRIP_PREFIXES])


def reset_demo_data(db) -> int:
    ids = select(models.Incident.id).where(_demo_filter())
    db.execute(
        update(models.Ambulance)
        .where(models.Ambulance.incident_id.in_(ids))
        .values(incident_id=None)
    )
    db.execute(delete(models.IncidentEvent).where(models.IncidentEvent.incident_id.in_(ids)))
    db.execute(delete(models.CaseOffer).where(models.CaseOffer.incident_id.in_(ids)))
    db.execute(delete(models.EmergencyContact).where(models.EmergencyContact.incident_id.in_(ids)))
    deleted = db.execute(delete(models.Incident).where(_demo_filter())).rowcount
    remaining_patients = select(models.Incident.patient_id).where(models.Incident.patient_id.is_not(None))
    db.execute(delete(models.PatientProfile).where(~models.PatientProfile.id.in_(remaining_patients)))
    db.commit()
    return deleted


def _timestamp(now: datetime) -> datetime:
    offset = random.randint(0, 730)
    day = now - timedelta(days=offset)
    if random.random() < 0.65:
        hour = random.choice(PEAK_HOURS)
    else:
        hour = random.randint(0, 23)
    if offset == 0:
        hour = min(hour, max(0, now.hour - 1))
    stamp = day.replace(
        hour=hour,
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
        microsecond=0,
    )
    return min(stamp, now - timedelta(minutes=5))


def _patient() -> models.PatientProfile:
    age = random.randint(0, 17) if random.random() < 0.08 else random.randint(18, 82)
    return models.PatientProfile(
        full_name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
        age=age,
        blood_type=random.choice(BLOOD_TYPES),
        gender=random.choices(["male", "female"], weights=[0.6, 0.4], k=1)[0],
        conditions=json.dumps([random.choice(CONDITIONS)]),
        medications=json.dumps([random.choice(MEDICATIONS)]),
        allergies=json.dumps([random.choice(ALLERGIES)]),
        notes=None,
    )


def _nearest_hospital(hospitals, lat: float, lon: float):
    return min(
        hospitals,
        key=lambda h: (h.lat - lat) ** 2 + (h.lon - lon) ** 2,
    )


def build_incident(index: int, now: datetime, hospitals) -> tuple[models.Incident, models.PatientProfile]:
    cluster = egypt.choose_cluster()
    lat, lon = egypt.random_point(cluster)
    severity = round(min(10.0, max(1.0, random.gauss(cluster["severity"], 1.4))), 1)
    impact_type = random.choice(IMPACT_TYPES)
    destination = "trauma_centre" if severity >= 8 else ("major" if severity >= 5.5 else "minor")
    created = _timestamp(now)
    occurred = created - timedelta(minutes=random.randint(1, 10))
    eta_scene = random.randint(180, 900)
    eta_hospital = random.randint(300, 1500)
    distance = float(random.randint(1000, 30000))

    hospital = None
    if hospitals and random.random() < 0.35:
        hospital = _nearest_hospital(hospitals, lat, lon)

    status = "cancelled" if random.random() < 0.04 else "closed"
    if status == "closed":
        closed = created + timedelta(seconds=eta_scene + eta_hospital + random.randint(180, 900))
    else:
        closed = created + timedelta(minutes=random.randint(2, 12))

    patient = _patient()
    incident = models.Incident(
        alert_id=f"alert-{uuid.uuid4().hex[:8]}",
        trip_id=f"national-demo-{index:06d}",
        severity=severity,
        severity_source="ai",
        severity_confidence=round(random.uniform(0.72, 0.99), 2),
        severity_summary=SUMMARIES[impact_type],
        mechanism=f"Reported {impact_type} impact on {egypt.random_road(cluster)}, {cluster['city']}.",
        lat=lat,
        lon=lon,
        governorate=cluster["governorate"],
        location_label=f"{egypt.random_road(cluster)}, {cluster['city']}",
        occurred_at=occurred,
        status=status,
        destination=destination,
        hospital_id=hospital.id if hospital else None,
        accepted_at=created + timedelta(seconds=random.randint(45, 240)) if hospital else None,
        accepted_by="demo" if hospital else None,
        broadcast_open=False,
        detection=json.dumps(
            {
                "rule": True,
                "ml_confidence": round(random.uniform(0.8, 0.99), 2),
                "destination": destination,
            }
        ),
        impact_factors=json.dumps(
            {
                "peak_g": round(3.0 + severity * 0.7, 2),
                "delta_v_mps": round(severity * 1.5, 2),
                "impact_type": impact_type,
            }
        ),
        eta_scene_seconds=eta_scene,
        eta_hospital_seconds=eta_hospital,
        distance_m=distance,
        created_at=created,
        updated_at=closed,
        closed_at=closed,
        patient=patient,
    )
    return incident, patient


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=12000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    random.seed(args.seed)
    migrations.apply(engine)

    db = SessionLocal()
    try:
        if args.reset:
            deleted = reset_demo_data(db)
            print(f"removed {deleted} existing demo incidents")

        hubs = demo_source.seed_hubs(db)
        if hubs:
            print(f"created {hubs} national demo response hubs")
        hospitals = db.query(models.Hospital).all()
        now = datetime.utcnow()
        counts: dict[str, int] = {}
        batch = 0
        for index in range(1, args.count + 1):
            incident, patient = build_incident(index, now, hospitals)
            db.add(patient)
            db.add(incident)
            counts[incident.governorate] = counts.get(incident.governorate, 0) + 1
            if index % 500 == 0:
                db.commit()
                batch += 1
                print(f"  {index}/{args.count} incidents", flush=True)
        db.commit()
        print(f"seeded {args.count} incidents across {len(counts)} governorates")
        for name in sorted(counts):
            print(f"  {name:15s} {counts[name]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

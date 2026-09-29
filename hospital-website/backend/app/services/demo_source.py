import asyncio
import random

from ..config import DEMO_SOURCE
from ..db import SessionLocal
from . import intake

INTERVAL_SECONDS = 12.0
BOUNDS = {"min_lat": 30.028, "max_lat": 30.048, "min_lon": 31.232, "max_lon": 31.250}

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
    severity = round(random.uniform(1.5, 9.5), 1)
    impact_type = random.choice(list(SUMMARY))
    destination = "trauma_centre" if severity >= 8 else ("major" if severity >= 5.5 else "minor")
    return {
        "trip_id": f"demo-{random.randint(1000, 9999)}",
        "severity": severity,
        "severity_source": "ai",
        "severity_confidence": round(random.uniform(0.8, 0.99), 2),
        "severity_summary": SUMMARY[impact_type],
        "location": {
            "lat": round(random.uniform(BOUNDS["min_lat"], BOUNDS["max_lat"]), 6),
            "lon": round(random.uniform(BOUNDS["min_lon"], BOUNDS["max_lon"]), 6),
        },
        "location_label": random.choice(
            ["Ring Road, Cairo", "Nile Corniche, Cairo", "Salah Salem Rd, Cairo", "El Nasr Rd, Cairo"]
        ),
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


async def run() -> None:
    while True:
        try:
            db = SessionLocal()
            try:
                await intake.create_case(db, _random_case())
            finally:
                db.close()
        except Exception as exc:
            print(f"[demo-source] {type(exc).__name__}: {exc}", flush=True)
        await asyncio.sleep(INTERVAL_SECONDS)


def enabled() -> bool:
    return DEMO_SOURCE.lower() in {"on", "1", "true", "yes"}

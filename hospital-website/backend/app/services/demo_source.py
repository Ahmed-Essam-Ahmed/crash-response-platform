import asyncio
import random

from ..config import DEMO_SOURCE
from ..db import SessionLocal
from . import intake

INTERVAL_SECONDS = 12.0
BOUNDS = {"min_lat": 30.028, "max_lat": 30.048, "min_lon": 31.232, "max_lon": 31.250}


def _random_crash() -> dict:
    severity = round(random.uniform(1.5, 9.5), 1)
    return {
        "trip_id": f"demo-{random.randint(1000, 9999)}",
        "severity": severity,
        "location": {
            "lat": round(random.uniform(BOUNDS["min_lat"], BOUNDS["max_lat"]), 6),
            "lon": round(random.uniform(BOUNDS["min_lon"], BOUNDS["max_lon"]), 6),
        },
        "medical_profile_ref": random.choice(["profile-0001", "profile-0002"]),
        "detection": {"rule": True, "ml_confidence": round(random.uniform(0.8, 0.99), 2)},
        "impact_factors": {
            "peak_g": round(3.0 + severity * 0.7, 2),
            "delta_v_mps": round(severity * 1.5, 2),
            "impact_type": random.choice(["frontal", "side", "rear", "rollover"]),
        },
    }


async def run() -> None:
    while True:
        try:
            db = SessionLocal()
            try:
                await intake.create_incident(db, _random_crash())
            finally:
                db.close()
        except Exception as exc:
            print(f"[demo-source] {type(exc).__name__}: {exc}", flush=True)
        await asyncio.sleep(INTERVAL_SECONDS)


def enabled() -> bool:
    return DEMO_SOURCE.lower() in {"on", "1", "true", "yes"}

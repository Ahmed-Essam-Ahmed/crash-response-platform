from .. import models
from ..db import SessionLocal

HOSPITALS = [
    {"code": "hosp-01", "name": "Riverside Trauma Centre", "lat": 30.0480, "lon": 31.2320,
     "capacity": 12, "trauma_level": 3, "ambulances": 3},
    {"code": "hosp-02", "name": "City General Hospital", "lat": 30.0380, "lon": 31.2500,
     "capacity": 10, "trauma_level": 2, "ambulances": 2},
    {"code": "hosp-03", "name": "Northside Community Hospital", "lat": 30.0300, "lon": 31.2380,
     "capacity": 8, "trauma_level": 1, "ambulances": 2},
]

DEFAULT_CONTACTS = [
    {"name": "Mother", "relation": "family", "phone": "+20 100 000 0001", "priority": 1},
    {"name": "Primary Care Physician", "relation": "medical", "phone": "+20 100 000 0002", "priority": 2},
]


def seed(db) -> None:
    if db.query(models.Hospital).count() == 0:
        for spec in HOSPITALS:
            db.add(models.Hospital(
                code=spec["code"], name=spec["name"], lat=spec["lat"], lon=spec["lon"],
                capacity=spec["capacity"], trauma_level=spec["trauma_level"], current_load=0,
            ))
        db.commit()

    for spec in HOSPITALS:
        existing = db.query(models.Ambulance).filter(models.Ambulance.hospital_code == spec["code"]).count()
        if existing == 0:
            for i in range(spec["ambulances"]):
                db.add(models.Ambulance(
                    code=f"amb-{spec['code'].split('-')[1]}{i + 1}",
                    lat=spec["lat"], lon=spec["lon"], status="available", hospital_code=spec["code"],
                ))
            db.commit()


def ensure_contacts(db, profile_ref: str) -> list:
    if not profile_ref:
        profile_ref = "profile-default"
    contacts = db.query(models.Contact).filter(models.Contact.profile_ref == profile_ref).all()
    if contacts:
        return contacts
    for spec in DEFAULT_CONTACTS:
        db.add(models.Contact(profile_ref=profile_ref, **spec))
    db.commit()
    return db.query(models.Contact).filter(models.Contact.profile_ref == profile_ref).all()


def reset(db) -> None:
    for model in (models.IncidentEvent, models.Incident, models.Ambulance, models.Contact):
        db.query(model).delete()
    for hospital in db.query(models.Hospital).all():
        hospital.current_load = 0
    db.commit()
    seed(db)


def session():
    return SessionLocal()

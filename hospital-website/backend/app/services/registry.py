from .. import models, security
from ..config import SEED_DEMO_LOGIN

DEMO_PASSWORD = "hospital123"

HOSPITALS = [
    {
        "code": "riverside-trauma-centre",
        "name": "Riverside Trauma Centre",
        "lat": 30.0480,
        "lon": 31.2320,
        "beds_total": 12,
        "trauma_level": 3,
        "ambulances": 3,
        "email": "riverside@demo.hospital",
    },
    {
        "code": "city-general-hospital",
        "name": "City General Hospital",
        "lat": 30.0380,
        "lon": 31.2500,
        "beds_total": 10,
        "trauma_level": 2,
        "ambulances": 2,
        "email": "citygeneral@demo.hospital",
    },
    {
        "code": "northside-community-hospital",
        "name": "Northside Community Hospital",
        "lat": 30.0300,
        "lon": 31.2380,
        "beds_total": 8,
        "trauma_level": 1,
        "ambulances": 2,
        "email": "northside@demo.hospital",
    },
]


def seed(db) -> None:
    if db.query(models.Hospital).count() == 0:
        for spec in HOSPITALS:
            db.add(
                models.Hospital(
                    code=spec["code"],
                    name=spec["name"],
                    lat=spec["lat"],
                    lon=spec["lon"],
                    address=f"{spec['name']}, Cairo",
                    trauma_level=spec["trauma_level"],
                    ambulances_total=spec["ambulances"],
                    ambulances_available=spec["ambulances"],
                    beds_total=spec["beds_total"],
                    beds_occupied=0,
                    current_load=0,
                )
            )
        db.commit()
    elif SEED_DEMO_LOGIN:
        for hospital in db.query(models.Hospital).all():
            if hospital.ambulances_total == 0:
                hospital.ambulances_total = 2
            if hospital.beds_total == 0:
                hospital.beds_total = 8
        db.commit()

    for spec in HOSPITALS:
        hospital = _match_demo_hospital(db, spec)
        if hospital is None:
            continue
        if not hospital.ambulances:
            _seed_fleet(db, hospital, spec["ambulances"])
        if SEED_DEMO_LOGIN and not db.query(models.User).filter(
            models.User.email == spec["email"]
        ).first():
            _seed_admin(db, hospital, spec["email"])


def _match_demo_hospital(db, spec):
    hospital = db.query(models.Hospital).filter(models.Hospital.code == spec["code"]).first()
    if hospital is not None:
        return hospital
    return db.query(models.Hospital).filter(models.Hospital.name == spec["name"]).first()


def _seed_fleet(db, hospital, count: int) -> None:
    from . import dispatch

    dispatch.resize_fleet(db, hospital, count)
    dispatch.sync_availability(db, hospital)
    db.commit()


def _seed_admin(db, hospital, email: str) -> None:
    salt, digest = security.hash_password(DEMO_PASSWORD)
    db.add(
        models.User(
            hospital_id=hospital.id,
            email=email,
            full_name=f"{hospital.name} Dispatch",
            password_hash=digest,
            password_salt=salt,
            role="admin",
        )
    )
    db.commit()


def reset(db) -> None:
    for model in (models.IncidentEvent, models.CaseOffer, models.PatientProfile, models.Incident, models.Ambulance):
        db.query(model).delete()
    for hospital in db.query(models.Hospital).all():
        hospital.current_load = 0
        hospital.beds_occupied = 0
    db.commit()
    seed(db)

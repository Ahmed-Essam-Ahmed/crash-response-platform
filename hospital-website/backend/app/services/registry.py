from .. import models, security
from ..config import SEED_DEMO_LOGIN
from ..domain.naming import normalize

DEMO_PASSWORD = "hospital123"
AUTHORITY_PASSWORD = "authority123"

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
    _seed_authority(db)
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
        _link_demo_registry(db, hospital, spec)
        if not hospital.ambulances:
            _seed_fleet(db, hospital, spec["ambulances"])
        if SEED_DEMO_LOGIN and not db.query(models.User).filter(
            models.User.email == spec["email"]
        ).first():
            _seed_admin(db, hospital, spec["email"])


def _seed_authority(db):
    if not db.query(models.User).filter(models.User.email == "authority@egypt.gov").first():
        salt, digest = security.hash_password(AUTHORITY_PASSWORD)
        db.add(
            models.User(
                hospital_id=None,
                email="authority@egypt.gov",
                full_name="National Road Safety Authority",
                password_hash=digest,
                password_salt=salt,
                role="authority",
            )
        )
        db.commit()


def _match_demo_hospital(db, spec):
    """Find the demo hospital by its stable code only.

    This used to fall back to matching on name, which meant that a real
    hospital registering with the name "City General Hospital" would be
    handed the demo tenant's fleet, beds, and admin account. Matching by name
    is only safe where the name is known to be ours, which is the case for
    the seeded demo admin below.
    """
    hospital = db.query(models.Hospital).filter(models.Hospital.code == spec["code"]).first()
    if hospital is not None:
        return hospital

    owner = (
        db.query(models.User)
        .filter(
            models.User.email == spec["email"],
            models.User.role == "admin",
        )
        .first()
    )
    return owner.hospital if owner is not None else None


def _link_demo_registry(db, hospital, spec) -> None:
    """Give the demo tenant a registry entry so the uniqueness rule applies.

    Marked source="demo" so it is never offered as a joinable hospital in a
    real deployment.
    """
    if hospital.registry_id is not None:
        return
    entry = db.query(models.RegistryHospital).filter(
        models.RegistryHospital.name_normalized == normalize(spec["name"]),
        models.RegistryHospital.governorate == "Cairo",
    ).first()
    if entry is None:
        entry = models.RegistryHospital(
            name=spec["name"],
            name_normalized=normalize(spec["name"]),
            governorate="Cairo",
            lat=spec["lat"],
            lon=spec["lon"],
            address=f"{spec['name']}, Cairo",
            source="demo",
        )
        db.add(entry)
        db.flush()
    hospital.registry_id = entry.id
    db.commit()


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

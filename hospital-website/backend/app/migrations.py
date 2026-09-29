"""Additive schema migrations.

`create_all` only creates missing tables, so columns added to an existing
model are invisible on a database created by an earlier version. These
helpers add them in place and backfill sensible defaults, which keeps the
existing seeded data instead of forcing a destructive rebuild.
"""

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from . import models
from .models import Base

HOSPITAL_COLUMNS = {
    "address": "VARCHAR",
    "phone": "VARCHAR",
    "emergency_phone": "VARCHAR",
    "ambulances_total": "INTEGER NOT NULL DEFAULT 0",
    "ambulances_available": "INTEGER NOT NULL DEFAULT 0",
    "beds_total": "INTEGER NOT NULL DEFAULT 0",
    "beds_occupied": "INTEGER NOT NULL DEFAULT 0",
    "created_at": "DATETIME",
}

INCIDENT_COLUMNS = {
    "severity_source": "VARCHAR NOT NULL DEFAULT 'ai'",
    "severity_confidence": "FLOAT",
    "severity_summary": "TEXT",
    "location_label": "VARCHAR",
    "occurred_at": "DATETIME",
    "patient_id": "INTEGER",
    "accepted_at": "DATETIME",
    "accepted_by": "VARCHAR",
    "broadcast_open": "BOOLEAN NOT NULL DEFAULT 0",
    "distance_m": "FLOAT",
}

ADDED_TABLES = (
    models.User,
    models.AuthToken,
    models.PatientProfile,
    models.CaseOffer,
)


def _existing_columns(bind, table: str) -> set[str]:
    if table not in set(inspect(bind).get_table_names()):
        return set()
    return {c["name"] for c in inspect(bind).get_columns(table)}


def apply(engine) -> list[str]:
    applied: list[str] = []

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        for table, columns in (("hospitals", HOSPITAL_COLUMNS), ("incidents", INCIDENT_COLUMNS)):
            present = _existing_columns(engine, table)
            for column, ddl in columns.items():
                if column in present:
                    continue
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'))
                applied.append(f"{table}.{column}")

    if applied:
        with engine.begin() as conn:
            conn.execute(text("UPDATE hospitals SET beds_total = capacity WHERE beds_total = 0"))
            conn.execute(
                text(
                    "UPDATE hospitals SET ambulances_total = ambulances_available "
                    "WHERE ambulances_total = 0"
                )
            )

    backfill_session(engine)
    return applied


def backfill_session(engine) -> None:
    db = Session(bind=engine)
    try:
        _repoint_legacy_rows(db)
        db.commit()
    finally:
        db.close()


def _repoint_legacy_rows(db: Session) -> None:
    """Map pre-multi-tenant rows onto the new hospital/user columns."""
    hospitals = {h.code: h for h in db.query(models.Hospital).all()}

    for amb in db.query(models.Ambulance).all():
        if amb.hospital_id is None and getattr(amb, "hospital_code", None) in hospitals:
            amb.hospital_id = hospitals[amb.hospital_code].id

    for incident in db.query(models.Incident).all():
        if incident.hospital_id is None and getattr(incident, "hospital_code", None) in hospitals:
            incident.hospital_id = hospitals[incident.hospital_code].id

    for hospital in db.query(models.Hospital).all():
        fleet = [a for a in hospital.ambulances]
        available = [a for a in fleet if a.is_available]
        if hospital.ambulances_total == 0:
            hospital.ambulances_total = len(fleet)
        if hospital.ambulances_available == 0:
            hospital.ambulances_available = len(available)
        if hospital.beds_total == 0:
            hospital.beds_total = getattr(hospital, "capacity", 0) or 0
        if hospital.beds_occupied == 0:
            hospital.beds_occupied = hospital.current_load

"""Additive schema migrations.

`create_all` only creates missing tables, so columns added to an existing
model are invisible on a database created by an earlier version. These
helpers add them in place and backfill sensible defaults, which keeps the
existing seeded data instead of forcing a destructive rebuild.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, MetaData, Table, inspect, text
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
    "mechanism": "TEXT",
    "route_outbound": "TEXT",
    "route_inbound": "TEXT",
    "location_label": "VARCHAR",
    "occurred_at": "DATETIME",
    "patient_id": "INTEGER",
    "hospital_id": "INTEGER",
    "accepted_at": "DATETIME",
    "accepted_by": "VARCHAR",
    "broadcast_open": "BOOLEAN NOT NULL DEFAULT 0",
    "distance_m": "FLOAT",
}

AMBULANCE_COLUMNS = {
    "label": "VARCHAR",
    "hospital_id": "INTEGER",
}

NEW_INDEXES = (
    ("ix_ambulances_hospital_id", "ambulances", "hospital_id"),
    ("ix_incidents_hospital_id", "incidents", "hospital_id"),
)

TABLES = (
    ("hospitals", HOSPITAL_COLUMNS),
    ("incidents", INCIDENT_COLUMNS),
    ("ambulances", AMBULANCE_COLUMNS),
)

LEGACY_OWNER = (("ambulances", "hospital_code"), ("incidents", "hospital_code"))

REBUILDABLE = (models.Hospital, models.Ambulance, models.Incident)


def _existing_columns(bind, table: str) -> set[str]:
    if table not in set(inspect(bind).get_table_names()):
        return set()
    return {c["name"] for c in inspect(bind).get_columns(table)}


def _existing_indexes(bind) -> set[str]:
    names: set[str] = set()
    for table in set(inspect(bind).get_table_names()):
        names.update(i["name"] for i in inspect(bind).get_indexes(table))
    return names


def apply(engine) -> list[str]:
    applied: list[str] = []

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        for table, columns in TABLES:
            present = _existing_columns(conn, table)
            for column, ddl in columns.items():
                if column in present:
                    continue
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'))
                applied.append(f"{table}.{column}")

    backfill_legacy_columns(engine)
    backfill_session(engine)

    for model in REBUILDABLE:
        applied.extend(_rebuild_legacy_table(engine, model))

    with engine.begin() as conn:
        indexed = _existing_indexes(conn)
        for name, table, column in NEW_INDEXES:
            if name in indexed or table not in set(inspect(conn).get_table_names()):
                continue
            conn.execute(text(f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" ({column})'))
            applied.append(f"index:{name}")

    return applied


def _rebuild_legacy_table(engine, model) -> list[str]:
    """Replace a table that still carries retired columns.

    A column the model no longer maps stays in the database, and SQLite has no
    way to relax its NOT NULL constraint, so inserts from the current code fail.
    The standard fix is the documented rebuild: create the current shape, copy
    the columns both versions share, then swap the names.
    """
    table = model.__table__
    if table.name not in set(inspect(engine).get_table_names()):
        return []

    with engine.begin() as conn:
        existing = {c["name"] for c in inspect(conn).get_columns(table.name)}
        current = {c.name for c in table.columns}
        if existing <= current:
            return []
        if table.name not in set(inspect(conn).get_table_names()):
            return []

        shared = [column for column in table.columns if column.name in existing]
        if not shared:
            return []

        target = f"{table.name}__rebuild"
        staging = MetaData()
        replacement = Table(target, staging, *[c._copy() for c in table.columns])

        fallback = {"now": datetime.utcnow().isoformat(sep=" ")}
        select = []
        for column in shared:
            ref = f'"{column.name}"'
            if not column.nullable:
                fallback[column.name] = _column_default(column)
                ref = f'COALESCE({ref}, :{column.name})'
            select.append(ref)
        names = ", ".join(f'"{column.name}"' for column in shared)
        columns = ", ".join(select)

        replacement.drop(bind=conn, checkfirst=True)
        replacement.create(bind=conn)
        conn.execute(
            text(f'INSERT INTO "{target}" ({names}) SELECT {columns} FROM "{table.name}"'),
            fallback,
        )
        conn.execute(text(f'DROP TABLE "{table.name}"'))
        conn.execute(text(f'ALTER TABLE "{target}" RENAME TO "{table.name}"'))
        for index in table.indexes:
            index.create(bind=conn, checkfirst=True)

    retired = sorted(existing - current)
    return [f"{table.name}:dropped {', '.join(retired)}"]


def _column_default(column) -> object:
    if isinstance(column.type, DateTime):
        return datetime.utcnow().isoformat(sep=" ")
    if isinstance(column.type, (Integer, Float)):
        return 0
    return ""


def backfill_legacy_columns(engine) -> None:
    with engine.begin() as conn:
        if "capacity" in _existing_columns(conn, "hospitals"):
            conn.execute(text("UPDATE hospitals SET beds_total = capacity WHERE beds_total = 0"))
        conn.execute(
            text(
                "UPDATE hospitals SET ambulances_total = ambulances_available "
                "WHERE ambulances_total = 0"
            )
        )


def backfill_session(engine) -> None:
    db = Session(bind=engine)
    try:
        _repoint_legacy_rows(db)
        db.commit()
    finally:
        db.close()


def _repoint_legacy_rows(db: Session) -> None:
    """Map pre-multi-tenant rows onto the new hospital/user columns."""
    by_code = {code: hid for hid, code in db.query(models.Hospital.id, models.Hospital.code).all()}
    bind = db.connection()
    moved = False

    for table, legacy_column in LEGACY_OWNER:
        present = _existing_columns(bind, table)
        if legacy_column not in present or "hospital_id" not in present:
            continue
        rows = db.execute(
            text(
                f'SELECT "id", "{legacy_column}" AS owner FROM "{table}" '
                f'WHERE hospital_id IS NULL AND "{legacy_column}" IS NOT NULL'
            )
        ).all()
        for row in rows:
            target = by_code.get(row.owner)
            if target is None:
                continue
            db.execute(
                text(f'UPDATE "{table}" SET hospital_id = :target WHERE "id" = :row'),
                {"target": target, "row": row.id},
            )
            moved = True

    if moved:
        db.expire_all()

    for hospital in db.query(models.Hospital).all():
        fleet = list(hospital.ambulances)
        ready = [a for a in fleet if a.is_available]
        if hospital.ambulances_total == 0:
            hospital.ambulances_total = len(fleet)
        if hospital.ambulances_available == 0:
            hospital.ambulances_available = len(ready)
        if hospital.beds_occupied == 0:
            hospital.beds_occupied = hospital.current_load

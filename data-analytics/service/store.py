"""Database store: read-only access to the hospital database.

Reads incidents, patients, events, hospitals, and offers. Derives region and
age buckets in a consistent shape so the analytics layer can remain simple.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from config import MAX_INCIDENTS
from regions import region_for


def load(db_path: str | Path) -> List[Dict[str, Any]]:
    path = Path(db_path)
    if not path.exists():
        return []

    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            """
            SELECT i.alert_id, i.trip_id, i.severity, i.severity_source, i.severity_confidence,
                   i.severity_summary, i.mechanism, i.lat, i.lon, i.location_label,
                   i.status, i.destination, i.hospital_id, i.patient_id, i.accepted_at,
                   i.created_at, i.updated_at, i.closed_at, i.eta_scene_seconds,
                   i.eta_hospital_seconds, i.distance_m,
                   p.full_name, p.age, p.blood_type, p.gender,
                   p.conditions, p.medications, p.allergies, p.notes,
                   h.code AS hospital_code, h.name AS hospital_name
            FROM incidents i
            LEFT JOIN patient_profiles p ON p.id = i.patient_id
            LEFT JOIN hospitals h ON h.id = i.hospital_id
            ORDER BY i.created_at DESC, i.id DESC
            LIMIT ?
            """,
            (MAX_INCIDENTS,),
        ).fetchall()
    finally:
        con.close()

    incidents: List[Dict[str, Any]] = []
    for r in rows:
        inc = dict(r)
        # normalize
        inc["severity"] = float(inc.get("severity") or 0.0)
        inc["age"] = inc.get("age")
        # region
        try:
            region = region_for(float(inc["lat"]), float(inc["lon"]))
        except Exception:
            region = None
        inc["region"] = region
        # age group
        ag = None
        try:
            a = int(inc["age"]) if inc["age"] not in (None, "") else None
            if a is not None:
                for gname, gmin, gmax in [
                    ("0-17", 0, 17),
                    ("18-25", 18, 25),
                    ("26-40", 26, 40),
                    ("41-60", 41, 60),
                    ("61+", 61, 200),
                ]:
                    if gmin <= a <= gmax:
                        ag = gname
                        break
        except Exception:
            pass
        inc["age_group"] = ag
        incidents.append(inc)

    # load events
    event_map = load_events(db_path)
    for inc in incidents:
        inc["events"] = event_map.get(inc["alert_id"], [])

    # load offers (for advanced timing if desired)
    offer_map = load_offers(db_path)
    for inc in incidents:
        inc["offers"] = offer_map.get(inc["alert_id"], [])

    return incidents


def load_events(db_path: str | Path) -> Dict[str, List[Dict[str, Any]]]:
    path = Path(db_path)
    if not path.exists():
        return {}
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            """
            SELECT e.id, e.incident_id, e.status, e.note, e.at_scene, e.created_at,
                   i.alert_id
            FROM incident_events e
            JOIN incidents i ON i.id = e.incident_id
            ORDER BY e.incident_id, e.created_at, e.id
            """
        ).fetchall()
    finally:
        con.close()
    out: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r["alert_id"]), []).append(dict(r))
    return out


def load_offers(db_path: str | Path) -> Dict[str, List[Dict[str, Any]]]:
    path = Path(db_path)
    if not path.exists():
        return {}
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            """
            SELECT o.id, o.incident_id, o.hospital_id, o.stage, o.status,
                   o.offered_at, o.expires_at, o.responded_at, o.responded_by,
                   i.alert_id
            FROM case_offers o
            JOIN incidents i ON i.id = o.incident_id
            ORDER BY o.incident_id, o.offered_at, o.id
            """
        ).fetchall()
    finally:
        con.close()
    out: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r["alert_id"]), []).append(dict(r))
    return out

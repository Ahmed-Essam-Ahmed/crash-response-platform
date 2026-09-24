import uuid
from datetime import datetime

from .. import models
from ..db import SessionLocal
from ..routers.streams import manager
from ..services.notifications import notify_contacts
from ..workflows.dispatch import dispatch_ambulance
from ..workflows.hospitals import assign_hospital


async def create_alert(payload: dict, db) -> dict:
    alert_id = f"alert-{uuid.uuid4().hex[:8]}"
    location = payload.get("location", {})
    factors = payload.get("factors") or {}
    severity = payload.get("severity", 0.0)
    severity = float(severity) if severity is not None else 0.0

    hospital = assign_hospital(db, location)
    ambulance = dispatch_ambulance(db, hospital, location)
    contacts = notify_contacts(db, payload)

    incident = models.Incident(
        alert_id=alert_id,
        trip_id=payload.get("trip_id", ""),
        severity=severity,
        lat=location.get("lat"),
        lon=location.get("lon"),
        impact_factors=json_dump(factors),
        contacts_notified=json_dump(contacts),
        hospital_id=hospital["code"],
        ambulance_id=ambulance["ambulance_id"],
        status="dispatched",
        created_at=datetime.utcnow(),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    message = {
        "schema_version": "1.0",
        "type": "emergency_alert",
        "alert_id": alert_id,
        "status": "dispatched",
        "severity": severity,
        "location": location,
        "contacts_notified": contacts,
        "assignment": {"hospital_id": hospital["code"], "ambulance_id": ambulance["ambulance_id"]},
        "eta_seconds": ambulance["eta_seconds"],
        "route": ambulance["route"],
        "created_at": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message)
    return message


def json_dump(obj):
    import json
    return json.dumps(obj, default=str)
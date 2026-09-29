import json
import uuid
from datetime import datetime

from .. import models, serializers
from ..domain import lifecycle, triage
from ..realtime import realtime
from . import dispatch, offers

PATIENT_FIELDS = ("full_name", "age", "blood_type", "gender", "conditions", "medications", "allergies", "notes")


def _json_list(value) -> str:
    if value is None:
        return None
    if isinstance(value, str):
        return json.dumps([value])
    return json.dumps(list(value))


def build_patient(db, payload: dict) -> models.PatientProfile:
    patient = payload.get("patient") or {}
    return models.PatientProfile(
        full_name=patient.get("name") or patient.get("full_name"),
        age=patient.get("age"),
        blood_type=patient.get("blood_type") or patient.get("bloodType"),
        gender=patient.get("gender"),
        conditions=_json_list(patient.get("conditions") or patient.get("medical_conditions")),
        medications=_json_list(patient.get("medications")),
        allergies=_json_list(patient.get("allergies")),
        notes=patient.get("notes"),
    )


async def _advance(db, incident, status, note=None, at_scene=False, announce=True):
    incident.status = lifecycle.assert_transition(incident.status, status)
    incident.updated_at = datetime.utcnow()
    db.add(models.IncidentEvent(incident_id=incident.id, status=incident.status, note=note, at_scene=at_scene))
    db.commit()
    db.refresh(incident)
    if announce:
        await offers.announce(db, incident, "incident_status")
    return incident


def build_contacts(db, incident, payload: dict) -> list[models.EmergencyContact]:
    rows = payload.get("emergency_contacts") or payload.get("contacts") or []
    contacts = []
    for index, entry in enumerate(rows):
        if not isinstance(entry, dict):
            continue
        contacts.append(
            models.EmergencyContact(
                incident_id=incident.id,
                full_name=entry.get("name") or entry.get("full_name"),
                relation=entry.get("relation") or entry.get("relationship"),
                phone=entry.get("phone") or entry.get("phone_number") or entry.get("mobile"),
                email=entry.get("email"),
                is_primary=bool(entry.get("primary") or entry.get("is_primary")),
                position=index,
            )
        )
    db.add_all(contacts)
    return contacts


async def create_case(db, payload: dict) -> models.Incident:
    location = payload.get("location") or {}
    severity = max(1.0, min(10.0, float(payload.get("severity") or 1.0)))
    trip_id = payload.get("trip_id") or f"trip-{uuid.uuid4().hex[:8]}"
    destination = triage.destination_for(severity)

    occurred_at = payload.get("occurred_at")
    if isinstance(occurred_at, str):
        occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00")).replace(tzinfo=None)
    elif not isinstance(occurred_at, datetime):
        occurred_at = datetime.utcnow()

    patient = build_patient(db, payload)
    db.add(patient)

    incident = models.Incident(
        alert_id=offers.new_alert_id(),
        trip_id=trip_id,
        severity=severity,
        severity_source=payload.get("severity_source") or "ai",
        severity_confidence=payload.get("severity_confidence"),
        severity_summary=payload.get("severity_summary") or payload.get("ai_summary"),
        mechanism=payload.get("mechanism") or (payload.get("impact_factors") or {}).get("mechanism"),
        lat=float(location.get("lat", 30.04)),
        lon=float(location.get("lon", 31.24)),
        location_label=payload.get("location_label") or location.get("label") or location.get("address"),
        occurred_at=occurred_at,
        status=lifecycle.Status.DETECTED.value,
        destination=destination.value,
        patient=patient,
        detection=json.dumps(payload.get("detection") or {}),
        impact_factors=json.dumps(payload.get("impact_factors") or payload.get("factors") or {}),
        created_at=datetime.utcnow(),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    build_contacts(db, incident, payload)
    db.add(models.IncidentEvent(incident_id=incident.id, status=incident.status, note="case received"))
    db.commit()

    await _advance(db, incident, lifecycle.Status.CONTACTS_NOTIFIED, note="emergency contacts notified")

    created = offers.open_case(db, incident)
    db.refresh(incident)

    await realtime.broadcast_all({
        "type": "case_opened",
        "alert_id": incident.alert_id,
        "required_resources": triage.required_resources(severity),
        "at": datetime.utcnow().isoformat(),
    })
    for offer in created:
        await offers.announce(db, incident, "case_offered")

    return incident


async def accept_case(db, incident, hospital, user):
    offers.accept(db, incident, hospital, user)
    db.refresh(incident)
    await _advance(
        db, incident,
        lifecycle.Status.AMBULANCE_ASSIGNED,
        note=f"accepted by {hospital.name}",
    )
    dispatch.sync_availability(db, hospital)
    return incident


async def decline_case(db, incident, hospital, user):
    offers.decline(db, incident, hospital, user)
    await offers.announce(db, incident, "case_updated")
    return incident


async def cancel_case(db, incident, hospital):
    for amb in incident.ambulances:
        amb.status = "available"
        amb.incident_id = None
    if incident.hospital is not None:
        incident.hospital.current_load = max(0, incident.hospital.current_load - 1)
        dispatch.sync_availability(db, incident.hospital)
    incident.status = lifecycle.Status.CANCELLED.value
    incident.closed_at = datetime.utcnow()
    db.add(models.IncidentEvent(incident_id=incident.id, status=incident.status, note="cancelled by hospital"))
    db.commit()
    db.refresh(incident)
    await offers.announce(db, incident, "case_closed")
    return incident

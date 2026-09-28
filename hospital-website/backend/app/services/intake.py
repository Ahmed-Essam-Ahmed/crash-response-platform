import json
import uuid
from datetime import datetime

from .. import models, serializers
from ..domain import geo, lifecycle, triage
from ..realtime import realtime
from . import dispatch, notifications


async def _advance(db, incident, status, note=None, at_scene=False):
    incident.status = lifecycle.assert_transition(incident.status, status)
    incident.updated_at = datetime.utcnow()
    event = models.IncidentEvent(incident_id=incident.id, status=incident.status, note=note, at_scene=at_scene)
    db.add(event)
    db.commit()
    db.refresh(incident)
    await realtime.broadcast({
        "type": "incident_status",
        "alert_id": incident.alert_id,
        "status": incident.status,
        "note": note,
        "at_scene": at_scene,
        "assignment": {
            "hospital_id": incident.hospital_code,
            "ambulance_ids": [a.code for a in incident.ambulances],
        },
        "at": datetime.utcnow().isoformat(),
    })
    return incident


async def create_incident(db, payload: dict) -> models.Incident:
    location = payload.get("location") or {}
    severity = float(payload.get("severity") or 0.0)
    trip_id = payload.get("trip_id") or f"trip-{uuid.uuid4().hex[:8]}"

    destination = triage.destination_for(severity)
    resources = triage.required_resources(severity)

    incident = models.Incident(
        alert_id=f"alert-{uuid.uuid4().hex[:8]}",
        trip_id=trip_id,
        severity=severity,
        lat=float(location.get("lat", 30.04)),
        lon=float(location.get("lon", 31.24)),
        status=lifecycle.Status.DETECTED.value,
        destination=destination.value,
        medical_profile_ref=payload.get("medical_profile_ref"),
        detection=json.dumps(payload.get("detection") or {}),
        impact_factors=json.dumps(payload.get("impact_factors") or payload.get("factors") or {}),
        created_at=datetime.utcnow(),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    db.add(models.IncidentEvent(incident_id=incident.id, status=incident.status, note="crash detected"))
    db.commit()

    await realtime.broadcast({
        "type": "incident_detected",
        "incident": serializers.incident_to_dict(incident, include_events=False),
        "required_resources": resources,
    })

    notifications.notify(db, incident.medical_profile_ref, incident)
    await _advance(db, incident, lifecycle.Status.CONTACTS_NOTIFIED, note="emergency contacts notified")

    hospital = dispatch.select_hospital(db, destination, {"lat": incident.lat, "lon": incident.lon})
    ambulances = dispatch.select_ambulances(
        db, hospital, {"lat": incident.lat, "lon": incident.lon}, resources["ambulances"]
    )

    scene = {"lat": incident.lat, "lon": incident.lon}
    lead = min(ambulances, key=lambda a: geo.haversine_m(a.lat, a.lon, scene["lat"], scene["lon"]))
    distance_m = geo.haversine_m(lead.lat, lead.lon, scene["lat"], scene["lon"])
    scene_eta = geo.eta_seconds(distance_m)
    hospital_eta = geo.eta_seconds(
        geo.haversine_m(hospital.lat, hospital.lon, scene["lat"], scene["lon"]),
        geo.LOAD_SPEED_MPS,
    )

    incident.hospital_code = hospital.code
    incident.eta_scene_seconds = scene_eta
    incident.eta_hospital_seconds = hospital_eta
    for amb in ambulances:
        amb.incident_id = incident.id
    dispatch.reserve(db, hospital, ambulances)
    db.commit()
    db.refresh(incident)

    await _advance(
        db, incident, lifecycle.Status.AMBULANCE_ASSIGNED,
        note=f"{len(ambulances)} ambulance(s) assigned from {hospital.name}",
    )
    return incident


async def cancel_incident(db, incident):
    for amb in incident.ambulances:
        amb.status = "available"
        amb.incident_id = None
    if incident.hospital is not None:
        incident.hospital.current_load = max(0, incident.hospital.current_load - 1)
    incident.status = lifecycle.Status.CANCELLED.value
    incident.closed_at = datetime.utcnow()
    db.add(models.IncidentEvent(incident_id=incident.id, status=incident.status, note="cancelled by operator"))
    db.commit()
    db.refresh(incident)
    await realtime.broadcast({
        "type": "incident_status",
        "alert_id": incident.alert_id,
        "status": incident.status,
        "note": "cancelled by operator",
        "at": datetime.utcnow().isoformat(),
    })
    return incident

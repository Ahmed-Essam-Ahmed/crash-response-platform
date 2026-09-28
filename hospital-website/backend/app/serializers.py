import json


def _load(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def event_to_dict(event) -> dict:
    return {
        "status": event.status,
        "note": event.note,
        "at_scene": event.at_scene,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


def ambulance_to_dict(amb) -> dict:
    return {
        "ambulance_id": amb.code,
        "lat": amb.lat,
        "lon": amb.lon,
        "status": amb.status,
        "hospital_id": amb.hospital_code,
        "incident_id": amb.incident_id,
    }


def hospital_to_dict(hospital) -> dict:
    return {
        "hospital_id": hospital.code,
        "name": hospital.name,
        "lat": hospital.lat,
        "lon": hospital.lon,
        "capacity": hospital.capacity,
        "trauma_level": hospital.trauma_level,
        "current_load": hospital.current_load,
        "free_beds": hospital.free_beds,
    }


def incident_to_dict(incident, include_events: bool = True) -> dict:
    payload = {
        "alert_id": incident.alert_id,
        "trip_id": incident.trip_id,
        "severity": incident.severity,
        "lat": incident.lat,
        "lon": incident.lon,
        "status": incident.status,
        "destination": incident.destination,
        "medical_profile_ref": incident.medical_profile_ref,
        "assignment": {
            "hospital_id": incident.hospital_code,
            "ambulance_ids": [a.code for a in incident.ambulances],
        },
        "eta_scene_seconds": incident.eta_scene_seconds,
        "eta_hospital_seconds": incident.eta_hospital_seconds,
        "detection": _load(incident.detection),
        "impact_factors": _load(incident.impact_factors),
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "updated_at": incident.updated_at.isoformat() if incident.updated_at else None,
        "closed_at": incident.closed_at.isoformat() if incident.closed_at else None,
    }
    if include_events:
        payload["events"] = [event_to_dict(e) for e in incident.events]
    return payload

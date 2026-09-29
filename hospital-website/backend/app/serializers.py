import json

from .domain import lifecycle


def _load(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _list(raw):
    value = _load(raw)
    if not value:
        return []
    return value if isinstance(value, list) else [value]


def _iso(value):
    return value.isoformat() if value else None


def contact_to_dict(contact) -> dict:
    return {
        "name": contact.full_name,
        "relation": contact.relation,
        "phone": contact.phone,
        "email": contact.email,
        "primary": bool(contact.is_primary),
    }


def event_to_dict(event) -> dict:
    return {
        "status": event.status,
        "note": event.note,
        "at_scene": event.at_scene,
        "created_at": _iso(event.created_at),
    }


def ambulance_to_dict(amb) -> dict:
    return {
        "ambulance_id": amb.code,
        "label": amb.label,
        "lat": amb.lat,
        "lon": amb.lon,
        "status": amb.status,
        "hospital_id": amb.hospital_id,
        "incident_id": amb.incident_id,
    }


def user_to_dict(user) -> dict:
    return {
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": _iso(user.created_at),
        "last_login_at": _iso(user.last_login_at),
    }


def patient_to_dict(patient) -> dict | None:
    if patient is None:
        return None
    return {
        "name": patient.full_name,
        "age": patient.age,
        "blood_type": patient.blood_type,
        "gender": patient.gender,
        "conditions": _list(patient.conditions),
        "medications": _list(patient.medications),
        "allergies": _list(patient.allergies),
        "notes": patient.notes,
    }


def hospital_to_dict(hospital) -> dict:
    return {
        "hospital_id": hospital.code,
        "name": hospital.name,
        "lat": hospital.lat,
        "lon": hospital.lon,
        "address": hospital.address,
        "location_label": hospital.location_label,
        "phone": hospital.phone,
        "emergency_phone": hospital.emergency_phone,
        "trauma_level": hospital.trauma_level,
        "ambulances_total": hospital.ambulances_total,
        "ambulances_available": hospital.ambulances_available,
        "beds_total": hospital.beds_total,
        "beds_occupied": hospital.beds_occupied,
        "free_beds": hospital.free_beds,
        "maps_url": maps_url(hospital.lat, hospital.lon),
    }


def maps_url(lat: float, lon: float, label: str | None = None) -> str:
    query = f"{lat},{lon}" + (f"({label})" if label else "")
    return f"https://www.google.com/maps/search/?api=1&query={query}"


def directions_url(lat: float, lon: float, from_lat=None, from_lon=None) -> str:
    if from_lat is not None and from_lon is not None:
        return (
            "https://www.google.com/maps/dir/?api=1"
            f"&origin={from_lat},{from_lon}&destination={lat},{lon}&travelmode=driving"
        )
    return maps_url(lat, lon)


def share_text(incident) -> str:
    patient = incident.patient
    who = patient.full_name if patient and patient.full_name else "Unknown patient"
    bits = [
        f"Case {incident.alert_id}",
        f"Patient: {who}",
        f"Location: {incident.lat:.6f}, {incident.lon:.6f}",
        f"Google Maps: {maps_url(incident.lat, incident.lon, incident.location_label)}",
    ]
    if incident.eta_scene_seconds:
        bits.append(f"Estimated arrival: {incident.eta_scene_seconds // 60} min")
    return "\n".join(bits)


def incident_to_dict(incident, include_events: bool = True, hospital=None) -> dict:
    payload = {
        "alert_id": incident.alert_id,
        "trip_id": incident.trip_id,
        "severity": incident.severity,
        "severity_source": incident.severity_source,
        "severity_confidence": incident.severity_confidence,
        "severity_summary": incident.severity_summary,
        "status": incident.status,
        "status_step": lifecycle.step_index(incident.status),
        "mechanism": incident.mechanism,
        "emergency_contacts": [contact_to_dict(c) for c in incident.contacts],
        "impact": _load(incident.impact_factors) or {},
        "destination": incident.destination,
        "patient": patient_to_dict(incident.patient),
        "location": {
            "lat": incident.lat,
            "lon": incident.lon,
            "label": incident.location_label,
            "maps_url": maps_url(incident.lat, incident.lon, incident.location_label),
            "directions_url": directions_url(
                incident.lat, incident.lon, hospital.lat if hospital else None, hospital.lon if hospital else None
            ),
        },
        "occurred_at": _iso(incident.occurred_at),
        "created_at": _iso(incident.created_at),
        "updated_at": _iso(incident.updated_at),
        "closed_at": _iso(incident.closed_at),
        "eta_scene_seconds": incident.eta_scene_seconds,
        "eta_hospital_seconds": incident.eta_hospital_seconds,
        "distance_m": incident.distance_m,
        "assignment": {
            "accepted": incident.hospital_id is not None,
            "accepted_at": _iso(incident.accepted_at),
            "accepted_by": incident.accepted_by,
            "ambulance_ids": [a.code for a in incident.ambulances],
        },
        "share_text": share_text(incident),
    }
    if include_events:
        payload["events"] = [event_to_dict(e) for e in incident.events]
    return payload


def offer_to_dict(offer, hospital=None) -> dict:
    from .domain import geo

    incident = offer.incident
    eta = None
    if hospital is not None:
        eta = geo.eta_seconds(geo.haversine_m(hospital.lat, hospital.lon, incident.lat, incident.lon))
    return {
        "offer_id": offer.id,
        "alert_id": incident.alert_id,
        "stage": offer.stage,
        "broadcast": offer.stage >= 900,
        "status": offer.status,
        "offered_at": _iso(offer.offered_at),
        "expires_at": _iso(offer.expires_at),
        "distance_m": offer.distance_m,
        "eta_seconds": eta,
    }

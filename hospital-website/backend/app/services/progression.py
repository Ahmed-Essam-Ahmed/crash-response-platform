import asyncio
import json
from datetime import datetime

from .. import models, serializers
from ..config import HANDOVER_SECONDS, ON_SCENE_SECONDS, PROGRESSION_TICK_SECONDS, TIME_SCALE
from ..db import SessionLocal
from ..domain import geo, lifecycle
from ..realtime import realtime
from . import dispatch

DURATIONS = {
    lifecycle.Status.AMBULANCE_ASSIGNED: 1.0,
    lifecycle.Status.AT_HOSPITAL: HANDOVER_SECONDS,
}


def _last_event(incident):
    return incident.events[-1] if incident.events else None


def _elapsed(event) -> float:
    if event is None or event.created_at is None:
        return 0.0
    return (datetime.utcnow() - event.created_at).total_seconds()


def _scaled(seconds) -> float:
    return float(seconds) / TIME_SCALE


def _next_for(incident):
    event = _last_event(incident)
    status = lifecycle.Status(incident.status)
    elapsed = _elapsed(event)

    if status is lifecycle.Status.AMBULANCE_ASSIGNED:
        if elapsed >= _scaled(DURATIONS[status]):
            return lifecycle.Status.EN_ROUTE_TO_SCENE, "ambulance rolling to scene", False
        return None

    if status is lifecycle.Status.EN_ROUTE_TO_SCENE:
        if elapsed >= _scaled(incident.eta_scene_seconds or 0):
            return lifecycle.Status.ON_SCENE, "paramedics on scene", True
        return None

    if status is lifecycle.Status.ON_SCENE:
        if elapsed >= _scaled(ON_SCENE_SECONDS):
            return lifecycle.Status.EN_ROUTE_TO_HOSPITAL, "patient loaded, transporting", False
        return None

    if status is lifecycle.Status.EN_ROUTE_TO_HOSPITAL:
        if elapsed >= _scaled(incident.eta_hospital_seconds or 0):
            name = incident.hospital.name if incident.hospital is not None else "hospital"
            return lifecycle.Status.AT_HOSPITAL, f"arrived at {name}", True
        return None

    if status is lifecycle.Status.AT_HOSPITAL:
        if elapsed >= _scaled(DURATIONS[status]):
            return lifecycle.Status.CLOSED, "patient handed over, case closed", False
        return None

    return None


def _stored_route(incident, field: str) -> list:
    raw = getattr(incident, field, None)
    if not raw:
        return []
    try:
        points = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(points, list) or len(points) < 2:
        return []
    return points


def _move_ambulances(incident) -> None:
    status = lifecycle.Status(incident.status)
    event = _last_event(incident)
    elapsed = _elapsed(event)

    if status is lifecycle.Status.EN_ROUTE_TO_SCENE:
        span = max(1.0, _scaled(incident.eta_scene_seconds or 1))
        progress = min(1.0, elapsed / span)
        path = _stored_route(incident, "route_outbound")
        for amb in incident.ambulances:
            if amb.hospital is None:
                continue
            if path:
                pos = geo.position_along(path, progress)
            else:
                pos = geo.interpolate(
                    amb.hospital.lat, amb.hospital.lon, incident.lat, incident.lon, progress
                )
            amb.lat, amb.lon = pos["lat"], pos["lon"]
            amb.status = "en_route"

    elif status is lifecycle.Status.ON_SCENE:
        for amb in incident.ambulances:
            amb.lat, amb.lon = incident.lat, incident.lon
            amb.status = "on_scene"

    elif status is lifecycle.Status.EN_ROUTE_TO_HOSPITAL:
        hospital = incident.hospital
        if hospital is None:
            return
        span = max(1.0, _scaled(incident.eta_hospital_seconds or 1))
        progress = min(1.0, elapsed / span)
        path = _stored_route(incident, "route_inbound")
        for amb in incident.ambulances:
            if path:
                pos = geo.position_along(path, progress)
            else:
                pos = geo.interpolate(incident.lat, incident.lon, hospital.lat, hospital.lon, progress)
            amb.lat, amb.lon = pos["lat"], pos["lon"]
            amb.status = "transporting"


async def _transition(db, incident, target, note, at_scene):
    incident.status = target.value
    incident.updated_at = datetime.utcnow()
    if target is lifecycle.Status.CLOSED:
        incident.closed_at = datetime.utcnow()
    db.add(models.IncidentEvent(incident_id=incident.id, status=target.value, note=note, at_scene=at_scene))
    db.commit()
    db.refresh(incident)

    hospital = incident.hospital
    if target is lifecycle.Status.CLOSED:
        for amb in incident.ambulances:
            amb.incident_id = None
            amb.status = "available"
            amb.lat, amb.lon = (hospital.lat, hospital.lon) if hospital else (amb.lat, amb.lon)
        if hospital is not None:
            hospital.current_load = max(0, hospital.current_load - 1)
            dispatch.sync_availability(db, hospital)
            dispatch.sync_beds(db, hospital)
        db.commit()
    else:
        _move_ambulances(incident)
        db.commit()

    if hospital is not None:
        await realtime.broadcast(
            {
                "type": "case_status",
                "alert_id": incident.alert_id,
                "status": target.value,
                "note": note,
                "at_scene": at_scene,
                "incident": serializers.incident_to_dict(incident, include_events=False),
                "hospital": serializers.hospital_to_dict(hospital),
                "at": datetime.utcnow().isoformat(),
            },
            hospital_id=hospital.id,
        )


def _assigned_active(db):
    return (
        db.query(models.Incident)
        .filter(
            models.Incident.hospital_id.isnot(None),
            models.Incident.status.notin_([lifecycle.Status.CLOSED.value, lifecycle.Status.CANCELLED.value]),
        )
        .all()
    )


async def tick() -> None:
    db = SessionLocal()
    try:
        for incident in _assigned_active(db):
            nxt = _next_for(incident)
            if nxt is not None:
                target, note, at_scene = nxt
                await _transition(db, incident, target, note, at_scene)
            else:
                before = [(a.code, round(a.lat, 6), round(a.lon, 6)) for a in incident.ambulances]
                _move_ambulances(incident)
                db.commit()
                after = [(a.code, round(a.lat, 6), round(a.lon, 6)) for a in incident.ambulances]
                if before != after:
                    await realtime.broadcast(
                        {
                            "type": "fleet_update",
                            "alert_id": incident.alert_id,
                            "status": incident.status,
                            "ambulances": [serializers.ambulance_to_dict(a) for a in incident.ambulances],
                        },
                        hospital_id=incident.hospital_id,
                    )
    finally:
        db.close()


async def advance(db, incident, note="advanced by hospital staff") -> models.Incident:
    target = lifecycle.default_next(incident.status)
    if target is None:
        raise lifecycle.InvalidTransition(incident.status, "no further step")
    await _transition(db, incident, target, note, at_scene=target is lifecycle.Status.ON_SCENE)
    return incident


async def run() -> None:
    while True:
        try:
            await tick()
        except Exception as exc:
            print(f"[progression] {type(exc).__name__}: {exc}", flush=True)
        await asyncio.sleep(PROGRESSION_TICK_SECONDS)

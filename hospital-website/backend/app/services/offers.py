"""Case offering and escalation.

A case is offered to the nearest eligible hospital first. If nobody accepts
within the offer window it moves to the next nearest, and so on, until the
case is broadcast to every eligible hospital at once. The first hospital to
accept owns it and every other hospital loses sight of it immediately.
"""

import uuid
from datetime import datetime, timedelta

from .. import models
from ..config import BROADCAST_AFTER_STAGES, OFFER_WINDOW_MINUTES
from ..domain import geo, lifecycle, triage
from ..realtime import realtime

PENDING = "pending"
ACCEPTED = "accepted"
DECLINED = "declined"
EXPIRED = "expired"
SUPERSEDED = "superseded"

BROADCAST_STAGE = 900


class OfferError(Exception):
    pass


def _scene(incident) -> dict:
    return {"lat": incident.lat, "lon": incident.lon}


def eligible_hospitals(db, incident) -> list[tuple[models.Hospital, float]]:
    """Hospitals that can take this case, nearest first.

    A hospital needs a free bed, a compatible trauma level, and at least one
    free ambulance. Capacity is part of eligibility so an escalated case never
    lands somewhere that visibly cannot help.
    """
    destination = triage.Destination(incident.destination)
    scene = _scene(incident)

    ranked = []
    for hospital in db.query(models.Hospital).all():
        if not triage.accepts(hospital.trauma_level, destination):
            continue
        if hospital.free_beds <= 0:
            continue
        if hospital.spare_ambulances <= 0:
            continue
        ranked.append((hospital, geo.haversine_m(hospital.lat, hospital.lon, scene["lat"], scene["lon"])))

    return sorted(ranked, key=lambda pair: pair[1])


def _offer_to(db, incident, hospital, distance, stage, window_minutes) -> models.CaseOffer:
    offer = models.CaseOffer(
        incident=incident,
        hospital=hospital,
        stage=stage,
        status=PENDING,
        offered_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=window_minutes),
        distance_m=distance,
    )
    db.add(offer)
    return offer


def open_case(db, incident) -> list[models.CaseOffer]:
    """Offer a freshly reported case to the nearest eligible hospital."""
    ranked = eligible_hospitals(db, incident)
    if not ranked:
        return []

    hospital, distance = ranked[0]
    offer = _offer_to(db, incident, hospital, distance, stage=1, window_minutes=OFFER_WINDOW_MINUTES)
    db.commit()
    return [offer]


def _broadcast(db, incident, ranked) -> list[models.CaseOffer]:
    incident.broadcast_open = True
    already = {o.hospital_id for o in incident.offers}
    created = [
        _offer_to(db, incident, hospital, distance, stage=BROADCAST_STAGE, window_minutes=OFFER_WINDOW_MINUTES)
        for hospital, distance in ranked
        if hospital.id not in already
    ]
    return created


def escalate_once(db) -> list[dict]:
    """Advance every offer whose window has run out. Driven by a background task."""
    now = datetime.utcnow()
    moved: list[dict] = []

    stale = (
        db.query(models.CaseOffer)
        .filter(models.CaseOffer.status == PENDING, models.CaseOffer.expires_at <= now)
        .all()
    )

    for offer in stale:
        offer.status = EXPIRED
        offer.responded_at = now
        incident = offer.incident
        if incident.hospital_id is not None or not incident.is_active:
            continue

        ranked = eligible_hospitals(db, incident)
        already = {o.hospital_id for o in incident.offers}
        next_stage = offer.stage + 1
        successors = [(h, d) for h, d in ranked if h.id not in already]

        if next_stage > BROADCAST_AFTER_STAGES or not successors:
            created = _broadcast(db, incident, ranked)
            if created:
                moved.append({"alert_id": incident.alert_id, "stage": "broadcast", "offers": len(created)})
            elif not any(o.status == PENDING for o in incident.offers):
                _close_unclaimed(db, incident, now)
                moved.append({"alert_id": incident.alert_id, "stage": "unclaimed"})
            db.commit()
            continue

        hospital, distance = successors[0]
        created = _offer_to(db, incident, hospital, distance, next_stage, OFFER_WINDOW_MINUTES)
        db.commit()
        moved.append({"alert_id": incident.alert_id, "stage": next_stage, "hospital": hospital.name})

    return moved


def _close_unclaimed(db, incident, now) -> None:
    incident.status = lifecycle.Status.CANCELLED.value
    incident.closed_at = now
    incident.broadcast_open = False
    db.add(
        models.IncidentEvent(
            incident_id=incident.id,
            status=incident.status,
            note="no hospital accepted this case before the offer window closed",
        )
    )


def expire_lapsed_broadcasts(db) -> list[str]:
    """Pick up any unassigned case that went quiet with no live offer left.

    This is a safety net behind `escalate_once`: normally a case with nobody
    left to offer to is closed there. The time guard stops a case being closed
    while it is still waiting for an eligible hospital to free capacity.
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=OFFER_WINDOW_MINUTES)
    closed = []
    waiting = (
        db.query(models.Incident)
        .filter(
            models.Incident.hospital_id.is_(None),
            models.Incident.status.notin_(
                [lifecycle.Status.CLOSED.value, lifecycle.Status.CANCELLED.value]
            ),
            models.Incident.created_at <= cutoff,
        )
        .all()
    )
    for incident in waiting:
        if any(o.status == PENDING for o in incident.offers):
            continue
        _close_unclaimed(db, incident, now)
        closed.append(incident.alert_id)
    if closed:
        db.commit()
    return closed


def pending_for(db, hospital_id) -> list[models.CaseOffer]:
    return (
        db.query(models.CaseOffer)
        .filter(
            models.CaseOffer.hospital_id == hospital_id,
            models.CaseOffer.status == PENDING,
            models.CaseOffer.expires_at > datetime.utcnow(),
        )
        .order_by(models.CaseOffer.offered_at.asc())
        .all()
    )


def my_offer(db, incident, hospital) -> models.CaseOffer | None:
    return (
        db.query(models.CaseOffer)
        .filter(
            models.CaseOffer.incident_id == incident.id,
            models.CaseOffer.hospital_id == hospital.id,
            models.CaseOffer.status == PENDING,
        )
        .order_by(models.CaseOffer.offered_at.desc())
        .first()
    )


def accept(db, incident, hospital, user) -> models.CaseOffer:
    now = datetime.utcnow()
    offer = my_offer(db, incident, hospital)
    if offer is None:
        raise OfferError("this case is not currently offered to your hospital")
    if offer.expires_at <= now:
        offer.status = EXPIRED
        db.commit()
        raise OfferError("this offer has expired")

    required = triage.required_resources(incident.severity)["ambulances"]
    fleet = [a for a in hospital.ambulances if a.is_available][:required]
    if not fleet:
        raise OfferError("no ambulance available at your hospital")

    distance = geo.haversine_m(hospital.lat, hospital.lon, incident.lat, incident.lon)
    lead = min(
        fleet,
        key=lambda a: geo.haversine_m(a.lat, a.lon, incident.lat, incident.lon),
    )
    scene_distance = geo.haversine_m(lead.lat, lead.lon, incident.lat, incident.lon)

    offer.status = ACCEPTED
    offer.responded_at = now
    offer.responded_by = user.email

    for other in incident.offers:
        if other.id != offer.id and other.status == PENDING:
            other.status = SUPERSEDED
            other.responded_at = now

    incident.hospital_id = hospital.id
    incident.accepted_at = now
    incident.accepted_by = user.email
    incident.distance_m = distance
    incident.eta_scene_seconds = geo.eta_seconds(scene_distance)
    incident.eta_hospital_seconds = geo.eta_seconds(distance, geo.LOAD_SPEED_MPS)
    incident.broadcast_open = False

    for amb in fleet:
        amb.incident_id = incident.id
        amb.status = "assigned"
    hospital.current_load += 1
    hospital.ambulances_available = max(0, hospital.ambulances_available - len(fleet))

    db.commit()
    return offer


def decline(db, incident, hospital, user) -> models.CaseOffer:
    offer = my_offer(db, incident, hospital)
    if offer is None:
        raise OfferError("this case is not currently offered to your hospital")
    offer.status = DECLINED
    offer.responded_at = datetime.utcnow()
    offer.responded_by = user.email
    db.commit()
    return offer


def new_alert_id() -> str:
    return f"alert-{uuid.uuid4().hex[:8]}"


async def announce(db, incident, event_type: str) -> None:
    """Tell every hospital that had the case on their board what just happened."""
    from .. import serializers

    recipients = {o.hospital_id for o in incident.offers}
    if incident.hospital_id is not None:
        recipients.add(incident.hospital_id)
    message = {
        "type": event_type,
        "alert_id": incident.alert_id,
        "incident": serializers.incident_to_dict(incident, include_events=False),
        "at": datetime.utcnow().isoformat(),
    }
    for hospital_id in recipients:
        await realtime.broadcast(message, hospital_id=hospital_id)

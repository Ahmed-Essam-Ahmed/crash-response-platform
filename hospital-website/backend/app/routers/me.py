from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models, serializers
from ..db import get_db
from ..deps import current_user, visible_hospital
from ..domain import lifecycle
from ..realtime import realtime
from ..services import dispatch, intake, offers

router = APIRouter(prefix="/me", tags=["me"])


class FleetUpdate(BaseModel):
    ambulances_total: int | None = Field(default=None, ge=0, le=200)
    ambulances_available: int | None = Field(default=None, ge=0, le=200)


class BedsUpdate(BaseModel):
    beds_total: int | None = Field(default=None, ge=0, le=5000)


async def _push_resource_update(hospital, kind: str) -> None:
    await realtime.broadcast(
        {
            "type": "capacity_changed",
            "kind": kind,
            "hospital": serializers.hospital_to_dict(hospital),
            "at": datetime.utcnow().isoformat(),
        },
        hospital_id=hospital.id,
    )


def _owned_incident(db, hospital, alert_id, *, require_assignment=False):
    incident = visible_hospital(db, alert_id, hospital)
    if require_assignment and incident.hospital_id != hospital.id:
        raise HTTPException(status_code=409, detail="accept the case before acting on it")
    return incident


@router.get("/hospital")
def my_hospital(user: models.User = Depends(current_user)):
    return serializers.hospital_to_dict(user.hospital)


@router.get("/cases")
def my_cases(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    hospital = user.hospital
    now = datetime.utcnow()

    mine = (
        db.query(models.Incident)
        .filter(models.Incident.hospital_id == hospital.id)
        .order_by(models.Incident.created_at.desc())
        .all()
    )

    offered_ids = [
        o.incident_id
        for o in db.query(models.CaseOffer)
        .filter(
            models.CaseOffer.hospital_id == hospital.id,
            models.CaseOffer.status == "pending",
            models.CaseOffer.expires_at > now,
        )
        .all()
    ]
    offers_by_incident = {
        o.incident_id: o
        for o in db.query(models.CaseOffer)
        .filter(models.CaseOffer.incident_id.in_(offered_ids), models.CaseOffer.hospital_id == hospital.id)
        .all()
    }
    offered = (
        db.query(models.Incident)
        .filter(models.Incident.id.in_(offered_ids), models.Incident.hospital_id.is_(None))
        .order_by(models.Incident.created_at.desc())
        .all()
    )

    active = [i for i in mine if lifecycle.is_active(i.status)]
    dispatch.sync_beds(db, hospital)
    db.commit()

    return {
        "assigned": [serializers.incident_to_dict(i, hospital=hospital) for i in active],
        "recent": [
            serializers.incident_to_dict(i, include_events=False, hospital=hospital)
            for i in mine
            if i not in active
        ][:20],
        "offers": [
            {
                **serializers.offer_to_dict(offers_by_incident[i.id], hospital),
                "incident": serializers.incident_to_dict(i, include_events=False, hospital=hospital),
            }
            for i in offered
        ],
    }


@router.get("/cases/{alert_id}")
def my_case(alert_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    incident = visible_hospital(db, alert_id, user.hospital)
    return serializers.incident_to_dict(incident, hospital=user.hospital)


@router.post("/cases/{alert_id}/accept")
async def accept_case(alert_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    incident = visible_hospital(db, alert_id, user.hospital)
    if incident.hospital_id is not None:
        if incident.hospital_id == user.hospital_id:
            return serializers.incident_to_dict(incident, hospital=user.hospital)
        raise HTTPException(status_code=409, detail="another hospital already took this case")
    try:
        incident = await intake.accept_case(db, incident, user.hospital, user)
    except offers.OfferError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except dispatch.CapacityError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return serializers.incident_to_dict(incident, hospital=user.hospital)


@router.post("/cases/{alert_id}/decline")
async def decline_case(alert_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    incident = visible_hospital(db, alert_id, user.hospital)
    try:
        await intake.decline_case(db, incident, user.hospital, user)
    except offers.OfferError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"declined": True, "alert_id": alert_id}


@router.post("/cases/{alert_id}/advance")
async def advance_case(alert_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    incident = _owned_incident(db, user.hospital, alert_id, require_assignment=True)
    nxt = lifecycle.default_next(incident.status)
    if nxt is None:
        raise HTTPException(status_code=409, detail=f"'{incident.status}' has no further step")
    from ..services import progression

    try:
        await progression.advance(db, incident)
    except lifecycle.InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.refresh(incident)
    dispatch.sync_beds(db, user.hospital)
    db.commit()
    return serializers.incident_to_dict(incident, hospital=user.hospital)


@router.post("/cases/{alert_id}/cancel")
async def cancel_case(alert_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    incident = _owned_incident(db, user.hospital, alert_id, require_assignment=True)
    if not lifecycle.can_transition(incident.status, lifecycle.Status.CANCELLED):
        raise HTTPException(status_code=409, detail=f"cannot cancel from '{incident.status}'")
    incident = await intake.cancel_case(db, incident, user.hospital)
    return serializers.incident_to_dict(incident, hospital=user.hospital)


@router.get("/fleet")
def my_fleet(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    hospital = user.hospital
    dispatch.sync_availability(db, hospital)
    db.commit()
    rows = sorted(hospital.ambulances, key=lambda a: a.id)
    return {
        "hospital": serializers.hospital_to_dict(hospital),
        "ambulances": [serializers.ambulance_to_dict(a) for a in rows],
    }


@router.patch("/fleet")
async def update_fleet(payload: FleetUpdate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    hospital = user.hospital
    try:
        if payload.ambulances_total is not None:
            dispatch.resize_fleet(db, hospital, payload.ambulances_total)
        if payload.ambulances_available is not None:
            dispatch.set_availability(db, hospital, payload.ambulances_available)
    except dispatch.CapacityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(hospital)
    await _push_resource_update(hospital, "fleet")
    return {
        "hospital": serializers.hospital_to_dict(hospital),
        "ambulances": [serializers.ambulance_to_dict(a) for a in sorted(hospital.ambulances, key=lambda a: a.id)],
    }


@router.get("/beds")
def my_beds(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    hospital = user.hospital
    dispatch.sync_beds(db, hospital)
    db.commit()
    return serializers.hospital_to_dict(hospital)


@router.patch("/beds")
async def update_beds(payload: BedsUpdate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    hospital = user.hospital
    try:
        dispatch.set_beds(db, hospital, payload.beds_total)
    except dispatch.CapacityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(hospital)
    await _push_resource_update(hospital, "beds")
    return serializers.hospital_to_dict(hospital)

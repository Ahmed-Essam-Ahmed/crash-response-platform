from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serializers
from ..db import get_db
from ..domain import lifecycle
from ..services import intake, progression

router = APIRouter(prefix="/incidents", tags=["incidents"])


class CrashReport(BaseModel):
    trip_id: str | None = None
    severity: float = 0.0
    location: dict = {}
    medical_profile_ref: str | None = None
    detection: dict | None = None
    impact_factors: dict | None = None
    factors: dict | None = None
    schema_version: str | None = None
    type: str | None = None


def _find(db, alert_id):
    incident = db.query(models.Incident).filter(models.Incident.alert_id == alert_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return incident


@router.post("", status_code=201)
async def report_crash(payload: CrashReport, db: Session = Depends(get_db)):
    incident = await intake.create_incident(db, payload.model_dump(exclude_none=True))
    return serializers.incident_to_dict(incident)


@router.get("")
def list_incidents(status: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.Incident)
    if status:
        if not lifecycle.can_transition(status, status) and status not in {s.value for s in lifecycle.Status}:
            raise HTTPException(status_code=400, detail="unknown status")
        query = query.filter(models.Incident.status == status)
    rows = query.order_by(models.Incident.created_at.desc()).limit(min(limit, 500)).all()
    return [serializers.incident_to_dict(r, include_events=False) for r in rows]


@router.get("/active")
def list_active(db: Session = Depends(get_db)):
    rows = db.query(models.Incident).filter(
        models.Incident.status.notin_([lifecycle.Status.CLOSED.value, lifecycle.Status.CANCELLED.value])
    ).order_by(models.Incident.created_at.desc()).all()
    return [serializers.incident_to_dict(r) for r in rows]


@router.get("/{alert_id}")
def get_incident(alert_id: str, db: Session = Depends(get_db)):
    return serializers.incident_to_dict(_find(db, alert_id))


@router.post("/{alert_id}/cancel")
async def cancel_incident(alert_id: str, db: Session = Depends(get_db)):
    incident = _find(db, alert_id)
    if not lifecycle.can_transition(incident.status, lifecycle.Status.CANCELLED):
        raise HTTPException(
            status_code=409,
            detail=f"cannot cancel from '{incident.status}'",
        )
    return serializers.incident_to_dict(await intake.cancel_incident(db, incident))


@router.post("/{alert_id}/advance")
async def advance_incident(alert_id: str, db: Session = Depends(get_db)):
    incident = _find(db, alert_id)
    nxt = lifecycle.default_next(incident.status)
    if nxt is None:
        raise HTTPException(status_code=409, detail=f"'{incident.status}' has no further step")
    try:
        await progression.advance(db, incident)
    except lifecycle.InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.refresh(incident)
    return serializers.incident_to_dict(incident)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, serializers
from ..db import get_db
from ..domain import lifecycle

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.get("")
def list_hospitals(db: Session = Depends(get_db)):
    rows = db.query(models.Hospital).order_by(models.Hospital.code).all()
    return [serializers.hospital_to_dict(h) for h in rows]


@router.get("/{code}")
def get_hospital(code: str, db: Session = Depends(get_db)):
    hospital = db.query(models.Hospital).filter(models.Hospital.code == code).first()
    if hospital is None:
        raise HTTPException(status_code=404, detail="hospital not found")
    return serializers.hospital_to_dict(hospital)


@router.get("/{code}/incoming")
def incoming(code: str, db: Session = Depends(get_db)):
    rows = db.query(models.Incident).filter(
        models.Incident.hospital_code == code,
        models.Incident.status.notin_([lifecycle.Status.CLOSED.value, lifecycle.Status.CANCELLED.value]),
    ).order_by(models.Incident.created_at.asc()).all()
    return [serializers.incident_to_dict(r, include_events=False) for r in rows]

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db import get_db
from ..services.alert_service import create_alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


class FactorPayload(BaseModel):
    peak_g: float = 0.0
    delta_v_mps: float = 0.0
    speed_at_impact_mps: float = 0.0
    impact_type: str = "frontal"
    post_crash_inactive: bool = False
    medical_risk: float = 0.0


class AlertPayload(BaseModel):
    type: str = "crash_detected"
    trip_id: str
    t: float = 0.0
    location: dict
    severity: float = 0.0
    medical_profile_ref: str = None
    detection: dict = {}
    factors: FactorPayload = None
    schema_version: str = "1.0"


@router.post("")
async def submit_alert(payload: AlertPayload, db: Session = Depends(get_db)):
    return await create_alert(payload.model_dump(), db)


@router.get("")
def list_alerts(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT alert_id, trip_id, severity, lat, lon, status, hospital_id, ambulance_id, "
             "contacts_notified, created_at FROM incidents ORDER BY created_at DESC LIMIT 200")
    ).mappings().all()
    return [dict(r) for r in rows]
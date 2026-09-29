from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models, serializers
from ..db import get_db
from ..deps import ingest_key
from ..services import intake

router = APIRouter(prefix="/cases", tags=["cases"])


class PatientPayload(BaseModel):
    name: str | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    blood_type: str | None = None
    gender: str | None = None
    conditions: list[str] | None = None
    medications: list[str] | None = None
    allergies: list[str] | None = None
    notes: str | None = None


class CasePayload(BaseModel):
    trip_id: str | None = None
    severity: float = Field(default=0.0, ge=0, le=20)
    severity_source: str | None = None
    severity_confidence: float | None = Field(default=None, ge=0, le=1)
    severity_summary: str | None = None
    location: dict
    location_label: str | None = None
    occurred_at: str | None = None
    patient: PatientPayload | None = None
    detection: dict | None = None
    impact_factors: dict | None = None


@router.post("", status_code=201, dependencies=[Depends(ingest_key)])
async def report_case(payload: CasePayload, db: Session = Depends(get_db)):
    """Intake for the mobile app and the AI model. Offers the case to the
    nearest eligible hospital rather than assigning it outright."""
    if "lat" not in payload.location or "lon" not in payload.location:
        raise HTTPException(status_code=422, detail="location needs lat and lon")
    incident = await intake.create_case(db, payload.model_dump(exclude_none=True))
    return serializers.incident_to_dict(incident, include_events=False)

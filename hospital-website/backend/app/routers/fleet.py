from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, serializers
from ..db import get_db

router = APIRouter(prefix="/fleet", tags=["fleet"])


@router.get("")
def list_fleet(db: Session = Depends(get_db)):
    rows = db.query(models.Ambulance).order_by(models.Ambulance.code).all()
    return [serializers.ambulance_to_dict(a) for a in rows]


@router.get("/available")
def list_available(db: Session = Depends(get_db)):
    rows = db.query(models.Ambulance).filter(models.Ambulance.status == "available").all()
    return [serializers.ambulance_to_dict(a) for a in rows]

from datetime import datetime

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from . import models, security
from .config import INGEST_API_KEY
from .db import get_db

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="sign in to continue",
    headers={"WWW-Authenticate": "Bearer"},
)


def _user_for_token(db: Session, raw: str | None):
    if not raw:
        raise CREDENTIALS_ERROR
    token_hash = security.hash_token(raw)
    record = (
        db.query(models.AuthToken)
        .filter(models.AuthToken.token_hash == token_hash, models.AuthToken.revoked_at.is_(None))
        .first()
    )
    if record is None or record.expires_at <= datetime.utcnow() or not record.user.is_active:
        raise CREDENTIALS_ERROR
    if record.user.hospital is None:
        raise CREDENTIALS_ERROR
    return record.user


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    raw = authorization[7:].strip() if authorization.lower().startswith("bearer ") else None
    return _user_for_token(db, raw)


def current_admin(user: models.User = Depends(current_user)):
    if not security.require_role(user.role, "admin"):
        raise HTTPException(status_code=403, detail="this action needs a hospital admin")
    return user


def ingest_key(x_ingest_key: str = Header(default="")) -> None:
    if not x_ingest_key or x_ingest_key != INGEST_API_KEY:
        raise HTTPException(status_code=401, detail="invalid ingest key")


def hospital_for(user: models.User) -> models.Hospital:
    return user.hospital


def visible_hospital(db: Session, alert_id: str, hospital: models.Hospital):
    """A case is visible only if this hospital was offered it or has accepted it."""
    incident = db.query(models.Incident).filter(models.Incident.alert_id == alert_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="case not found")
    if incident.hospital_id == hospital.id:
        return incident
    offered = db.query(models.CaseOffer).filter(
        models.CaseOffer.incident_id == incident.id,
        models.CaseOffer.hospital_id == hospital.id,
        models.CaseOffer.status == "pending",
    ).first()
    if offered is not None and offered.expires_at > datetime.utcnow():
        return incident
    raise HTTPException(status_code=404, detail="case not found")

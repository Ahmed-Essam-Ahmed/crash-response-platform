import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from .. import models, security, serializers
from ..db import get_db
from ..deps import current_admin, current_user
from ..services import dispatch
from ..realtime import realtime

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: str
    password: str
    full_name: str = ""

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("use at least 8 characters")
        return v


class StaffCreate(Credentials):
    role: str = "dispatcher"

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in security.ROLES:
            raise ValueError(f"role must be one of {', '.join(security.ROLES)}")
        return v


class HospitalRegistration(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    address: str | None = None
    phone: str | None = None
    emergency_phone: str | None = None
    trauma_level: int = Field(default=1, ge=1, le=3)
    ambulances_total: int = Field(default=2, ge=0, le=200)
    ambulances_available: int | None = Field(default=None, ge=0, le=200)
    beds_total: int = Field(default=10, ge=0, le=5000)
    beds_occupied: int = Field(default=0, ge=0, le=5000)
    admin: Credentials


def _new_hospital_code(name: str) -> str:
    slug = "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-")
    slug = "-".join(part for part in slug.split("-") if part) or "hospital"
    return f"{slug[:40]}-{uuid.uuid4().hex[:6]}"


def _create_user(db, hospital, payload: Credentials, role: str) -> models.User:
    salt, digest = security.hash_password(payload.password)
    user = models.User(
        hospital_id=hospital.id,
        email=payload.email,
        full_name=payload.full_name or payload.email.split("@")[0],
        password_hash=digest,
        password_salt=salt,
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def _issue(db, user: models.User) -> dict:
    raw, hashed = security.new_token()
    db.add(models.AuthToken(user_id=user.id, token_hash=hashed, expires_at=security.token_expiry()))
    db.commit()
    db.refresh(user)
    return {"token": raw, "expires_at": security.token_expiry().isoformat()}


@router.post("/register", status_code=201)
def register(payload: HospitalRegistration, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.admin.email).first():
        raise HTTPException(status_code=409, detail="an account already uses that email address")

    available = payload.ambulances_available
    if available is None:
        available = payload.ambulances_total
    available = min(available, payload.ambulances_total)

    hospital = models.Hospital(
        code=_new_hospital_code(payload.name),
        name=payload.name.strip(),
        lat=payload.lat,
        lon=payload.lon,
        address=payload.address,
        phone=payload.phone,
        emergency_phone=payload.emergency_phone,
        trauma_level=payload.trauma_level,
        ambulances_total=payload.ambulances_total,
        ambulances_available=available,
        beds_total=payload.beds_total,
        beds_occupied=min(payload.beds_occupied, payload.beds_total),
        current_load=0,
    )
    db.add(hospital)
    db.flush()

    dispatch.resize_fleet(db, hospital, payload.ambulances_total)
    dispatch.set_availability(db, hospital, available)

    user = _create_user(db, hospital, payload.admin, "admin")
    session = _issue(db, user)

    return {
        **session,
        "user": serializers.user_to_dict(user),
        "hospital": serializers.hospital_to_dict(hospital),
    }


@router.post("/login")
def login(payload: Credentials, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.strip().lower()).first()
    if user is None or not security.verify_password(payload.password, user.password_salt, user.password_hash):
        raise HTTPException(status_code=401, detail="email or password is incorrect")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="this account has been deactivated")

    user.last_login_at = datetime.utcnow()
    session = _issue(db, user)
    return {
        **session,
        "user": serializers.user_to_dict(user),
        "hospital": serializers.hospital_to_dict(user.hospital),
    }


@router.get("/me")
def me(user: models.User = Depends(current_user)):
    return {
        "user": serializers.user_to_dict(user),
        "hospital": serializers.hospital_to_dict(user.hospital),
    }


@router.post("/logout")
def logout(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    db.query(models.AuthToken).filter(
        models.AuthToken.user_id == user.id, models.AuthToken.revoked_at.is_(None)
    ).update({"revoked_at": datetime.utcnow()})
    db.commit()
    return {"signed_out": True}


@router.get("/staff")
def list_staff(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(models.User).filter(models.User.hospital_id == user.hospital_id).order_by(models.User.id)
    return [serializers.user_to_dict(row) for row in rows]


@router.post("/staff", status_code=201)
def add_staff(payload: StaffCreate, admin: models.User = Depends(current_admin), db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="an account already uses that email address")
    user = _create_user(db, admin.hospital, payload, payload.role)
    db.commit()
    return serializers.user_to_dict(user)


@router.delete("/staff/{user_id}")
def remove_staff(
    user_id: int,
    admin: models.User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if target is None or target.hospital_id != admin.hospital_id:
        raise HTTPException(status_code=404, detail="staff member not found")
    if target.id == admin.id:
        raise HTTPException(status_code=409, detail="you cannot remove your own account")
    if db.query(models.User).filter(
        models.User.hospital_id == admin.hospital_id, models.User.role == "admin", models.User.is_active.is_(True)
    ).count() <= 1 and target.role == "admin":
        raise HTTPException(status_code=409, detail="your hospital needs at least one admin")

    target.is_active = False
    db.query(models.AuthToken).filter(models.AuthToken.user_id == target.id).update(
        {"revoked_at": datetime.utcnow()}
    )
    db.commit()
    return {"removed": True, "user_id": user_id}

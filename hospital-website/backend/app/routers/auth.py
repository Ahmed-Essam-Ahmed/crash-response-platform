import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from .. import models, security, serializers
from ..config import INVITATION_TTL_HOURS, PUBLIC_WEB_URL, REGISTRY_REVIEW_KEY
from ..db import get_db
from ..deps import current_admin, current_user
from ..domain.naming import normalize
from ..domain import lifecycle
from ..realtime import realtime
from ..services import dispatch, hospital_registry, mail

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


class HospitalJoin(BaseModel):
    """Claim a registry entry.

    There is no name here on purpose. The registry entry is the hospital's
    identity, so a caller cannot introduce a hospital by naming one, and the
    name plus governorate pair is already unique in the registry.
    """

    registry_id: int
    admin: Credentials
    trauma_level: int = Field(default=1, ge=1, le=3)
    ambulances_total: int = Field(default=2, ge=0, le=200)
    ambulances_available: int | None = Field(default=None, ge=0, le=200)
    beds_total: int = Field(default=10, ge=0, le=5000)
    phone: str | None = None
    emergency_phone: str | None = None
    # Only needed for a registry entry the geocoder could not resolve.
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class HospitalClaimRequest(BaseModel):
    """Ask for a hospital that is not in the registry yet."""

    name: str = Field(min_length=2, max_length=160)
    governorate: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    address: str | None = None
    phone: str | None = None
    claimed_by_name: str = Field(min_length=2, max_length=120)
    email: str
    evidence: str | None = Field(default=None, max_length=2000)

    @field_validator("governorate")
    @classmethod
    def check_governorate(cls, v: str) -> str:
        v = v.strip()
        if v not in hospital_registry.GOVERNORATES:
            raise ValueError("choose a governorate")
        return v

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("enter a valid email address")
        return v


class ClaimReview(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class PlatformCapacityUpdate(BaseModel):
    beds_total: int | None = Field(default=None, ge=0, le=5000)
    ambulances_total: int | None = Field(default=None, ge=0, le=200)
    ambulances_available: int | None = Field(default=None, ge=0, le=200)


def _require_registry_reviewer(x_review_key: str = Header(default="")) -> None:
    if not REGISTRY_REVIEW_KEY or not secrets.compare_digest(x_review_key, REGISTRY_REVIEW_KEY):
        raise HTTPException(status_code=401, detail="registry review access is not configured")


class InvitationCreate(BaseModel):
    email: str
    role: str = "dispatcher"

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("enter a valid email address")
        return v

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        if v not in security.ROLES:
            raise ValueError(f"role must be one of {', '.join(security.ROLES)}")
        return v


class InvitationAccept(BaseModel):
    password: str = Field(min_length=8)
    full_name: str = Field(default="", max_length=120)


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


def _entry_to_dict(db, entry: models.RegistryHospital) -> dict:
    return {
        "id": entry.id,
        "name": entry.name,
        "name_ar": entry.name_ar,
        "governorate": entry.governorate,
        "lat": entry.lat,
        "lon": entry.lon,
        "address": entry.address,
        "has_location": entry.has_location,
        "claimed": hospital_registry.tenant_for(db, entry.id) is not None,
    }


@router.get("/registry")
def search_registry(
    q: str = Query(default="", max_length=120),
    governorate: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Look up your hospital by name before claiming it.

    Public because the alternative is a person guessing whether their hospital
    is supported. It exposes names and governorates, which are public
    directory data, and never accounts, staff, or cases.
    """
    rows = hospital_registry.search(db, query=q, governorate=governorate, limit=limit)
    return {
        "query": q,
        "results": [_entry_to_dict(db, row) for row in rows],
        "governorates": list(hospital_registry.GOVERNORATES),
    }


@router.post("/join", status_code=201)
def join_hospital(payload: HospitalJoin, db: Session = Depends(get_db)):
    """Claim a registry entry and become its first admin."""
    entry = db.get(models.RegistryHospital, payload.registry_id)
    if entry is None or not entry.is_active:
        raise HTTPException(status_code=404, detail="that hospital is not in the registry")

    if db.query(models.User).filter(models.User.email == payload.admin.email).first():
        raise HTTPException(status_code=409, detail="an account already uses that email address")

    if hospital_registry.tenant_for(db, entry.id) is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{entry.name} already has an account. Ask your hospital admin to send "
                "you an invitation."
            ),
        )

    # A second tenant for a hospital that already exists under a different
    # registry entry is the same duplicate, reached by a different route.
    for twin in hospital_registry.same_name_elsewhere(
        db, entry.name, entry.governorate, exclude_id=entry.id
    ):
        if hospital_registry.tenant_for(db, twin.id) is not None:
            raise HTTPException(
                status_code=409,
                detail=f"{entry.name} already has an account. Ask your admin for an invitation.",
            )

    lat, lon = entry.lat, entry.lon
    if lat is None or lon is None:
        lat, lon = payload.lat, payload.lon
    if lat is None or lon is None:
        raise HTTPException(
            status_code=422,
            detail=(
                f"{entry.name} has no confirmed location yet. Search for the address so the "
                "ambulance routes are correct."
            ),
        )

    for close in hospital_registry.nearby(db, lat, lon):
        if close.id != entry.id and hospital_registry.tenant_for(db, close.id) is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"this address is already registered to {close.name}. Ask your hospital "
                    "admin for an invitation instead of creating a second account."
                ),
            )

    available = payload.ambulances_available
    if available is None:
        available = payload.ambulances_total
    available = min(available, payload.ambulances_total)

    hospital = models.Hospital(
        code=_new_hospital_code(entry.name),
        name=entry.name,
        lat=lat,
        lon=lon,
        address=entry.address,
        phone=payload.phone,
        emergency_phone=payload.emergency_phone,
        registry_id=entry.id,
        trauma_level=payload.trauma_level,
        ambulances_total=payload.ambulances_total,
        ambulances_available=available,
        beds_total=payload.beds_total,
        beds_occupied=0,
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


@router.post("/claims", status_code=202)
def submit_claim(payload: HospitalClaimRequest, db: Session = Depends(get_db)):
    """Ask for a hospital that is not in the registry yet.

    Accepted for review, not immediately trusted: this creates no tenant, so
    a stranger cannot put a made up hospital into the dispatch network by
    asking nicely.
    """
    normalized = normalize(payload.name)

    existing = hospital_registry.search(db, query=payload.name, limit=1)
    if existing and (
        existing[0].name_normalized == normalized
        or normalize(existing[0].name_ar or "") == normalized
    ):
        return {
            "status": "already_listed",
            "registry_id": existing[0].id,
            "message": f"{existing[0].name} is already in the registry, you can join it directly.",
        }

    pending = (
        db.query(models.HospitalClaim)
        .filter(
            models.HospitalClaim.name_normalized == normalized,
            models.HospitalClaim.governorate == payload.governorate,
            models.HospitalClaim.reviewed_at.is_(None),
        )
        .first()
    )
    if pending is not None:
        # Rate limit and dedupe in one: a repeated submission returns the
        # original rather than queueing the same request again.
        return {
            "status": "already_pending",
            "claim_id": pending.id,
            "message": "this request is already waiting for review",
        }

    claim = models.HospitalClaim(
        name=payload.name.strip(),
        name_normalized=normalized,
        governorate=payload.governorate,
        lat=payload.lat,
        lon=payload.lon,
        address=payload.address,
        phone=payload.phone,
        claimed_by_email=payload.email,
        claimed_by_name=payload.claimed_by_name,
        evidence=payload.evidence,
    )
    db.add(claim)
    db.commit()
    return {
        "status": "pending_review",
        "claim_id": claim.id,
        "message": "we will add this hospital and email you once it is reviewed",
    }


@router.get("/review/claims", dependencies=[Depends(_require_registry_reviewer)])
def pending_hospital_claims(db: Session = Depends(get_db)):
    """List outstanding registry requests for a platform reviewer."""
    rows = (
        db.query(models.HospitalClaim)
        .filter(models.HospitalClaim.reviewed_at.is_(None))
        .order_by(models.HospitalClaim.created_at, models.HospitalClaim.id)
        .all()
    )
    return [
        {
            "id": row.id,
            "name": row.name,
            "governorate": row.governorate,
            "lat": row.lat,
            "lon": row.lon,
            "address": row.address,
            "phone": row.phone,
            "claimed_by_name": row.claimed_by_name,
            "claimed_by_email": row.claimed_by_email,
            "evidence": row.evidence,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/review/overview", dependencies=[Depends(_require_registry_reviewer)])
def platform_overview(db: Session = Depends(get_db)):
    """Cross-hospital operational snapshot for the national admin console."""
    hospitals = db.query(models.Hospital).order_by(models.Hospital.name).all()
    ambulances = db.query(models.Ambulance).order_by(models.Ambulance.code).all()
    active_incidents = (
        db.query(models.Incident)
        .filter(models.Incident.status.notin_(["closed", "cancelled"]))
        .order_by(models.Incident.created_at.desc())
        .all()
    )
    pending_claims = (
        db.query(models.HospitalClaim)
        .filter(models.HospitalClaim.reviewed_at.is_(None))
        .order_by(models.HospitalClaim.created_at, models.HospitalClaim.id)
        .all()
    )
    hospital_names = {hospital.id: hospital.name for hospital in hospitals}
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "hospitals": [
            {
                **serializers.hospital_to_dict(hospital),
                "id": hospital.id,
                "staff_count": len(hospital.users),
                "registry_id": hospital.registry_id,
            }
            for hospital in hospitals
        ],
        "ambulances": [
            {
                **serializers.ambulance_to_dict(unit),
                "hospital_name": hospital_names.get(unit.hospital_id, "Unassigned"),
                "incident_alert_id": unit.incident.alert_id if unit.incident else None,
            }
            for unit in ambulances
        ],
        "incidents": [
            {
                **serializers.incident_to_dict(incident, include_events=False, hospital=incident.hospital),
                "alert_id": incident.alert_id,
                "severity": incident.severity,
                "status": incident.status,
                "lat": incident.lat,
                "lon": incident.lon,
                "location_label": incident.location_label,
                "created_at": incident.created_at.isoformat() if incident.created_at else None,
                "updated_at": incident.updated_at.isoformat() if incident.updated_at else None,
                "hospital_name": hospital_names.get(incident.hospital_id),
                "hospital_id": incident.hospital_id,
                "ambulance_ids": [unit.code for unit in incident.ambulances],
            }
            for incident in active_incidents
        ],
        "pending_claims": [
            {
                "id": claim.id,
                "name": claim.name,
                "governorate": claim.governorate,
                "lat": claim.lat,
                "lon": claim.lon,
                "address": claim.address,
                "phone": claim.phone,
                "claimed_by_name": claim.claimed_by_name,
                "claimed_by_email": claim.claimed_by_email,
                "evidence": claim.evidence,
                "created_at": claim.created_at.isoformat() if claim.created_at else None,
            }
            for claim in pending_claims
        ],
    }


@router.get("/review/incidents/{alert_id}", dependencies=[Depends(_require_registry_reviewer)])
def platform_incident_details(alert_id: str, db: Session = Depends(get_db)):
    """Return the existing case detail shape to the national console."""
    incident = db.query(models.Incident).filter(models.Incident.alert_id == alert_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return serializers.incident_to_dict(incident, include_events=True, hospital=incident.hospital)


@router.patch("/review/hospitals/{hospital_id}/capacity", dependencies=[Depends(_require_registry_reviewer)])
async def platform_update_capacity(
    hospital_id: int, payload: PlatformCapacityUpdate, db: Session = Depends(get_db)
):
    """Allow a platform operator to adjust any hospital's beds and fleet."""
    hospital = db.get(models.Hospital, hospital_id)
    if hospital is None:
        raise HTTPException(status_code=404, detail="hospital not found")
    try:
        if payload.ambulances_total is not None:
            dispatch.resize_fleet(db, hospital, payload.ambulances_total)
        if payload.ambulances_available is not None:
            dispatch.set_availability(db, hospital, payload.ambulances_available)
        if payload.beds_total is not None:
            dispatch.set_beds(db, hospital, payload.beds_total)
    except dispatch.CapacityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(hospital)
    await realtime.broadcast(
        {
            "type": "capacity_changed",
            "kind": "platform_admin",
            "hospital": serializers.hospital_to_dict(hospital),
            "at": datetime.utcnow().isoformat(),
        },
        hospital_id=hospital.id,
    )
    return serializers.hospital_to_dict(hospital)


@router.post("/review/incidents/{alert_id}/advance", dependencies=[Depends(_require_registry_reviewer)])
async def platform_advance_incident(alert_id: str, db: Session = Depends(get_db)):
    """Advance an assigned incident one legal lifecycle step as a superadmin."""
    incident = db.query(models.Incident).filter(models.Incident.alert_id == alert_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    if incident.hospital_id is None:
        raise HTTPException(status_code=409, detail="incident must be accepted by a hospital before it can advance")
    from ..services import progression

    try:
        await progression.advance(db, incident, note="advanced by platform superadmin")
    except lifecycle.InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"alert_id": incident.alert_id, "status": incident.status}


@router.post("/review/incidents/{alert_id}/cancel", dependencies=[Depends(_require_registry_reviewer)])
async def platform_cancel_incident(alert_id: str, payload: ClaimReview = ClaimReview(), db: Session = Depends(get_db)):
    """Cancel an active incident across hospital boundaries."""
    incident = db.query(models.Incident).filter(models.Incident.alert_id == alert_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    if not lifecycle.can_transition(incident.status, lifecycle.Status.CANCELLED):
        raise HTTPException(status_code=409, detail=f"cannot cancel from '{incident.status}'")
    hospital = incident.hospital
    for ambulance in incident.ambulances:
        ambulance.status = "available"
        ambulance.incident_id = None
        if hospital is not None:
            ambulance.lat, ambulance.lon = hospital.lat, hospital.lon
    if hospital is not None:
        hospital.current_load = max(0, hospital.current_load - 1)
        dispatch.sync_availability(db, hospital)
        dispatch.sync_beds(db, hospital)
    incident.status = lifecycle.Status.CANCELLED.value
    incident.closed_at = datetime.utcnow()
    db.add(models.IncidentEvent(
        incident_id=incident.id,
        status=incident.status,
        note=f"cancelled by platform superadmin{': ' + payload.note if payload.note else ''}",
    ))
    db.commit()
    db.refresh(incident)
    await realtime.broadcast_all({"type": "case_closed", "alert_id": incident.alert_id, "at": datetime.utcnow().isoformat()})
    return {"alert_id": incident.alert_id, "status": incident.status}


@router.post("/review/claims/{claim_id}/approve", dependencies=[Depends(_require_registry_reviewer)])
def approve_hospital_claim(
    claim_id: int, payload: ClaimReview = ClaimReview(), db: Session = Depends(get_db)
):
    """Approve a request into the registry; the claimant must still join."""
    claim = db.query(models.HospitalClaim).filter(models.HospitalClaim.id == claim_id).with_for_update().first()
    if claim is None:
        raise HTTPException(status_code=404, detail="claim not found")
    if not claim.is_pending:
        raise HTTPException(status_code=409, detail="claim has already been reviewed")

    duplicate = (
        db.query(models.RegistryHospital)
        .filter(
            models.RegistryHospital.name_normalized == claim.name_normalized,
            models.RegistryHospital.governorate == claim.governorate,
        )
        .first()
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=f"{duplicate.name} is already in the registry; review this request as rejected",
        )

    nearby = hospital_registry.nearby(db, claim.lat, claim.lon)
    if nearby:
        raise HTTPException(
            status_code=409,
            detail=f"the submitted location is near {nearby[0].name}; review this request as rejected",
        )

    entry = models.RegistryHospital(
        name=claim.name,
        name_normalized=claim.name_normalized,
        governorate=claim.governorate,
        lat=claim.lat,
        lon=claim.lon,
        address=claim.address,
        source="claim",
    )
    db.add(entry)
    db.flush()
    claim.registry_hospital_id = entry.id
    claim.reviewed_at = datetime.utcnow()
    claim.review_note = payload.note
    db.commit()

    join_url = PUBLIC_WEB_URL.rstrip("/")
    subject = f"{claim.name} is now in the hospital registry"
    body = (
        f"Hello {claim.claimed_by_name},\n\n"
        f"Your request was approved and {claim.name} is now available in the registry. "
        f"Visit {join_url} and choose it to create your hospital's first admin account.\n"
    )
    try:
        mail_sent = mail.send(claim.claimed_by_email, subject, body)
    except mail.MailError:
        mail_sent = False
    return {
        "status": "approved",
        "claim_id": claim.id,
        "registry_id": entry.id,
        "mail_sent": mail_sent,
    }


@router.post("/review/claims/{claim_id}/reject", dependencies=[Depends(_require_registry_reviewer)])
def reject_hospital_claim(
    claim_id: int, payload: ClaimReview = ClaimReview(), db: Session = Depends(get_db)
):
    """Close a claim without adding a hospital or tenant."""
    claim = db.query(models.HospitalClaim).filter(models.HospitalClaim.id == claim_id).with_for_update().first()
    if claim is None:
        raise HTTPException(status_code=404, detail="claim not found")
    if not claim.is_pending:
        raise HTTPException(status_code=409, detail="claim has already been reviewed")

    claim.reviewed_at = datetime.utcnow()
    claim.review_note = payload.note or "Request declined during review."
    db.commit()

    body = (
        f"Hello {claim.claimed_by_name},\n\n"
        f"We could not add {claim.name} to the hospital registry at this time. "
        f"{claim.review_note}\n"
    )
    try:
        mail_sent = mail.send(claim.claimed_by_email, f"Update on your {claim.name} request", body)
    except mail.MailError:
        mail_sent = False
    return {"status": "rejected", "claim_id": claim.id, "mail_sent": mail_sent}


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


def _invitation_to_dict(row: models.StaffInvitation) -> dict:
    return {
        "id": row.id,
        "email": row.email,
        "role": row.role,
        "status": _invitation_status(row),
        "created_at": row.created_at,
        "expires_at": row.expires_at,
        "accepted_at": row.accepted_at,
        "revoked_at": row.revoked_at,
    }


def _invitation_status(row: models.StaffInvitation) -> str:
    if row.accepted_at is not None:
        return "accepted"
    if row.revoked_at is not None:
        return "revoked"
    if row.expires_at <= datetime.utcnow():
        return "expired"
    return "pending"


def _find_open_invitation(db, raw_token: str) -> models.StaffInvitation:
    row = (
        db.query(models.StaffInvitation)
        .filter(models.StaffInvitation.token_hash == security.hash_token(raw_token))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="this invitation link is not valid")
    status = _invitation_status(row)
    if status == "accepted":
        raise HTTPException(status_code=409, detail="this invitation has already been used")
    if status == "revoked":
        raise HTTPException(status_code=410, detail="this invitation was withdrawn")
    if status == "expired":
        raise HTTPException(status_code=410, detail="this invitation has expired, ask for a new one")
    return row


@router.get("/invitations/{token}")
def preview_invitation(token: str, db: Session = Depends(get_db)):
    """Show what an invitation is for before the recipient sets a password."""
    row = _find_open_invitation(db, token)
    return {
        "hospital": row.hospital.name,
        "address": row.hospital.address,
        "role": row.role,
        "email": mail.mask(row.email),
        "expires_at": row.expires_at,
    }


@router.post("/invitations/{token}/accept", status_code=201)
def accept_invitation(
    token: str,
    payload: InvitationAccept,
    db: Session = Depends(get_db),
):
    """Turn an invitation into an account.

    The email is taken from the invitation, never from the request body, so
    a forwarded link cannot be redeemed by someone else. Whoever holds the
    link sets their own password here rather than being given one by the
    admin.
    """
    row = _find_open_invitation(db, token)

    if db.query(models.User).filter(models.User.email == row.email).first():
        raise HTTPException(
            status_code=409,
            detail="an account already uses this email address, sign in instead",
        )

    hospital = row.hospital
    salt, digest = security.hash_password(payload.password)
    user = models.User(
        hospital_id=hospital.id,
        email=row.email,
        full_name=payload.full_name or row.email.split("@")[0],
        password_hash=digest,
        password_salt=salt,
        role=row.role,
    )
    db.add(user)
    db.flush()

    row.accepted_at = datetime.utcnow()
    session = _issue(db, user)

    return {
        **session,
        "user": serializers.user_to_dict(user),
        "hospital": serializers.hospital_to_dict(hospital),
    }


@router.get("/staff")
def list_staff(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(models.User).filter(models.User.hospital_id == user.hospital_id).order_by(models.User.id)
    return [serializers.user_to_dict(row) for row in rows]


@router.get("/staff/invitations")
def list_invitations(
    admin: models.User = Depends(current_admin), db: Session = Depends(get_db)
):
    rows = (
        db.query(models.StaffInvitation)
        .filter(models.StaffInvitation.hospital_id == admin.hospital_id)
        .order_by(models.StaffInvitation.id.desc())
        .limit(100)
        .all()
    )
    return [_invitation_to_dict(row) for row in rows]


@router.post("/staff/invitations", status_code=201)
def invite_staff(
    payload: InvitationCreate,
    admin: models.User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    """Invite a colleague by email.

    The previous version created the account with a password the admin chose
    and read out over the phone, which meant a weak shared password and no
    proof the address belonged to the person. Now the account does not exist
    until the recipient sets their own password from a link sent to them.
    """
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="an account already uses that email address")

    if not security.require_role(admin.role, payload.role):
        raise HTTPException(
            status_code=403, detail="you cannot grant a role higher than your own"
        )

    open_invitation = (
        db.query(models.StaffInvitation)
        .filter(
            models.StaffInvitation.hospital_id == admin.hospital_id,
            models.StaffInvitation.email == payload.email,
            models.StaffInvitation.accepted_at.is_(None),
            models.StaffInvitation.revoked_at.is_(None),
        )
        .first()
    )
    if open_invitation is not None and _invitation_status(open_invitation) == "pending":
        raise HTTPException(
            status_code=409, detail="there is already a pending invitation for this address"
        )

    raw, hashed = security.new_token()
    row = models.StaffInvitation(
        hospital_id=admin.hospital_id,
        email=payload.email,
        role=payload.role,
        token_hash=hashed,
        invited_by_user_id=admin.id,
        expires_at=datetime.utcnow() + timedelta(hours=INVITATION_TTL_HOURS),
    )
    db.add(row)
    db.commit()

    link = f"{PUBLIC_WEB_URL}/invite/{raw}"
    body = (
        f"{admin.full_name} has invited you to join {admin.hospital.name} on the "
        f"Crash Response Platform as {payload.role}.\n\n"
        f"Set your password here:\n{link}\n\n"
        f"The link expires in {INVITATION_TTL_HOURS} hours. "
        f"If you were not expecting this, ignore it and nothing will happen.\n"
    )
    delivered = mail.send(payload.email, f"Your invitation to {admin.hospital.name}", body)

    return {
        **_invitation_to_dict(row),
        "invite_link": link,
        "mail_sent": delivered,
        "mail_configured": mail.is_configured(),
    }


@router.delete("/staff/invitations/{invitation_id}")
def revoke_invitation(
    invitation_id: int,
    admin: models.User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    row = (
        db.query(models.StaffInvitation)
        .filter(
            models.StaffInvitation.id == invitation_id,
            models.StaffInvitation.hospital_id == admin.hospital_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="invitation not found")
    if row.accepted_at is not None:
        raise HTTPException(
            status_code=409, detail="this invitation was already accepted, remove the account instead"
        )
    if row.revoked_at is None:
        row.revoked_at = datetime.utcnow()
        db.commit()
    return {"revoked": True, "invitation_id": invitation_id}


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

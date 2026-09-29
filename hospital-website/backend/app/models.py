from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .domain.lifecycle import Status


class Base(DeclarativeBase):
    pass


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    emergency_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    trauma_level: Mapped[int] = mapped_column(Integer, default=1)
    ambulances_total: Mapped[int] = mapped_column(Integer, default=0)
    ambulances_available: Mapped[int] = mapped_column(Integer, default=0)
    beds_total: Mapped[int] = mapped_column(Integer, default=0)
    beds_occupied: Mapped[int] = mapped_column(Integer, default=0)
    current_load: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="hospital", cascade="all, delete-orphan")
    ambulances = relationship("Ambulance", back_populates="hospital")
    incidents = relationship("Incident", back_populates="hospital")
    offers = relationship("CaseOffer", back_populates="hospital", cascade="all, delete-orphan")

    @property
    def free_beds(self) -> int:
        return max(0, self.beds_total - self.beds_occupied)

    @property
    def spare_ambulances(self) -> int:
        return max(0, self.ambulances_available)

    @property
    def location_label(self) -> str:
        return self.address or f"{self.lat:.5f}, {self.lon:.5f}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    password_salt: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="dispatcher")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    hospital = relationship("Hospital", back_populates="users")
    tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="tokens")


class Ambulance(Base):
    __tablename__ = "ambulances"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="available")
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True, index=True)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), nullable=True)

    hospital = relationship("Hospital", back_populates="ambulances")
    incident = relationship("Incident", back_populates="ambulances")

    @property
    def is_available(self) -> bool:
        return self.status == "available" and self.incident_id is None


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    blood_type: Mapped[str | None] = mapped_column(String, nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    medications: Mapped[str | None] = mapped_column(Text, nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    incidents = relationship("Incident", back_populates="patient")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    trip_id: Mapped[str] = mapped_column(String, index=True)
    severity: Mapped[float] = mapped_column(Float, default=0.0)
    severity_source: Mapped[str] = mapped_column(String, default="ai")
    severity_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    location_label: Mapped[str | None] = mapped_column(String, nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default=Status.DETECTED.value, index=True)
    destination: Mapped[str] = mapped_column(String, default="minor")
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True, index=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patient_profiles.id"), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    accepted_by: Mapped[str | None] = mapped_column(String, nullable=True)
    broadcast_open: Mapped[bool] = mapped_column(Boolean, default=False)
    detection: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_factors: Mapped[str | None] = mapped_column(Text, nullable=True)
    eta_scene_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eta_hospital_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    events = relationship("IncidentEvent", back_populates="incident", cascade="all, delete-orphan")
    ambulances = relationship("Ambulance", back_populates="incident")
    hospital = relationship("Hospital", back_populates="incidents")
    patient = relationship("PatientProfile", back_populates="incidents")
    offers = relationship("CaseOffer", back_populates="incident", cascade="all, delete-orphan")

    @property
    def is_active(self) -> bool:
        from .domain.lifecycle import is_active

        return is_active(self.status)

    @property
    def is_assigned(self) -> bool:
        return self.hospital_id is not None


class CaseOffer(Base):
    __tablename__ = "case_offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    stage: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)
    offered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    responded_by: Mapped[str | None] = mapped_column(String, nullable=True)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    incident = relationship("Incident", back_populates="offers")
    hospital = relationship("Hospital", back_populates="offers")

    __table_args__ = (Index("ix_case_offers_incident_status", "incident_id", "status"),)


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    status: Mapped[str] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    at_scene: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="events")

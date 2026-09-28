from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
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
    capacity: Mapped[int] = mapped_column(Integer, default=10)
    trauma_level: Mapped[int] = mapped_column(Integer, default=1)
    current_load: Mapped[int] = mapped_column(Integer, default=0)

    ambulances = relationship("Ambulance", back_populates="hospital")
    incidents = relationship("Incident", back_populates="hospital")

    @property
    def free_beds(self) -> int:
        return max(0, self.capacity - self.current_load)


class Ambulance(Base):
    __tablename__ = "ambulances"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="available")
    hospital_code: Mapped[str | None] = mapped_column(ForeignKey("hospitals.code"), nullable=True)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.id"), nullable=True)

    hospital = relationship("Hospital", back_populates="ambulances")
    incident = relationship("Incident", back_populates="ambulances")

    @property
    def is_available(self) -> bool:
        return self.status == "available"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    trip_id: Mapped[str] = mapped_column(String, index=True)
    severity: Mapped[float] = mapped_column(Float, default=0.0)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default=Status.DETECTED.value, index=True)
    destination: Mapped[str] = mapped_column(String, default="minor")
    hospital_code: Mapped[str | None] = mapped_column(ForeignKey("hospitals.code"), nullable=True)
    medical_profile_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    detection: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_factors: Mapped[str | None] = mapped_column(Text, nullable=True)
    eta_scene_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eta_hospital_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    events = relationship("IncidentEvent", back_populates="incident", cascade="all, delete-orphan")
    ambulances = relationship("Ambulance", back_populates="incident")
    hospital = relationship("Hospital", back_populates="incidents")

    @property
    def is_active(self) -> bool:
        from .domain.lifecycle import is_active

        return is_active(self.status)


class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    status: Mapped[str] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    at_scene: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="events")


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_ref: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)
    relation: Mapped[str] = mapped_column(String)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

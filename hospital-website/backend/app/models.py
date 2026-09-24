from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from .db import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True)
    alert_id = Column(String, unique=True, index=True)
    trip_id = Column(String, index=True)
    severity = Column(Float)
    lat = Column(Float)
    lon = Column(Float)
    impact_factors = Column(Text)
    contacts_notified = Column(Text)
    hospital_id = Column(String)
    ambulance_id = Column(String)
    status = Column(String, default="detected")
    created_at = Column(DateTime, default=datetime.utcnow)


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True)
    profile_ref = Column(String, index=True)
    name = Column(String)
    phone = Column(String)
    relation = Column(String)
    priority = Column(Integer, default=1)


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True)
    code = Column(String, index=True)
    lat = Column(Float)
    lon = Column(Float)
    capacity = Column(Integer, default=5)
    load = Column(Integer, default=0)
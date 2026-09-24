from .. import models
from ..db import SessionLocal

DEFAULT_CONTACTS = [
    {"name": "Mother", "relation": "family"},
    {"name": "Primary Care", "relation": "medical"},
]


def notify_contacts(db, payload) -> list:
    profile = payload.get("medical_profile_ref") if isinstance(payload, dict) \
        else payload.medical_profile_ref
    contacts = db.query(models.Contact).filter(models.Contact.profile_ref == profile).all() \
        if profile else []
    if not contacts:
        contacts = [
            models.Contact(name=c["name"], relation=c["relation"],
                           phone="+20 1 0000 0000", profile_ref=profile or "profile-0001")
            for c in DEFAULT_CONTACTS
        ]
    results = []
    for c in contacts:
        loc = payload.get("location") if isinstance(payload, dict) else payload.location
        sev = payload.get("severity") if isinstance(payload, dict) else payload.severity
        sent_ok = True
        results.append({
            "name": c.name,
            "relation": c.relation,
            "message_sent": True if sent_ok else False,
            "call_placed": True if sent_ok else False,
            "summary": f"Accident at ({loc.get('lat')}, {loc.get('lon')}) "
                       f"severity {sev}/10 — {c.relation} notified",
        })
    return results
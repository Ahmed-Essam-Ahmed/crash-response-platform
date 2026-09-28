from datetime import datetime

from .. import models
from . import registry


def notify(db, profile_ref: str, incident) -> list:
    contacts = registry.ensure_contacts(db, profile_ref)
    now = datetime.utcnow()
    notified = []
    for contact in sorted(contacts, key=lambda c: c.priority):
        contact.notified_at = now
        notified.append({
            "name": contact.name,
            "relation": contact.relation,
            "phone": contact.phone,
            "message_sent": True,
            "call_placed": contact.priority == 1,
            "notified_at": now.isoformat(),
        })
    db.commit()
    return notified

import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.domain import triage
from app.services import dispatch, intake, offers


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def seed(db):
    near = models.Hospital(code="near", name="Near General", lat=30.0405, lon=31.2405,
                           trauma_level=1, beds_total=4, ambulances_total=2)
    mid = models.Hospital(code="mid", name="Mid Trauma", lat=30.0480, lon=31.2320,
                          trauma_level=3, beds_total=4, ambulances_total=2)
    far = models.Hospital(code="far", name="Far Trauma", lat=30.0300, lon=31.2500,
                          trauma_level=3, beds_total=4, ambulances_total=2)
    extra_a = models.Hospital(code="extra-a", name="Extra A", lat=30.0600, lon=31.2600,
                              trauma_level=3, beds_total=4, ambulances_total=2)
    extra_b = models.Hospital(code="extra-b", name="Extra B", lat=30.0200, lon=31.2200,
                              trauma_level=3, beds_total=4, ambulances_total=2)
    hospitals = [near, mid, far, extra_a, extra_b]
    db.add_all(hospitals)
    db.commit()
    for hospital in hospitals:
        dispatch.resize_fleet(db, hospital, 2)
        dispatch.set_availability(db, hospital, 2)
    db.commit()
    return near, mid, far


def make_incident(db, severity=6.0, destination=None):
    incident = models.Incident(
        alert_id=offers.new_alert_id(),
        trip_id="t-1",
        severity=severity,
        lat=30.0400,
        lon=31.2400,
        status="contacts_notified",
        destination=(destination or triage.destination_for(severity)).value,
    )
    db.add(incident)
    db.commit()
    return incident


USER = SimpleNamespace(email="dispatch@near.test")
LATER = datetime.utcnow() + timedelta(hours=1)


class OpenTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.near, self.mid, self.far = seed(self.db)

    def test_opens_with_nearest_eligible(self):
        incident = make_incident(self.db)
        created = offers.open_case(self.db, incident)
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0].hospital_id, self.near.id)

    def test_trauma_case_skips_non_trauma_nearest(self):
        incident = make_incident(self.db, severity=9.0)
        created = offers.open_case(self.db, incident)
        self.assertEqual(created[0].hospital_id, self.mid.id)

    def test_full_nearest_is_skipped(self):
        self.near.beds_occupied = self.near.beds_total
        self.db.commit()
        incident = make_incident(self.db)
        created = offers.open_case(self.db, incident)
        self.assertNotEqual(created[0].hospital_id, self.near.id)


class EscalationTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.near, self.mid, self.far = seed(self.db)

    def _expire(self, offer):
        offer.expires_at = datetime.utcnow() - timedelta(seconds=1)
        self.db.commit()

    def _expire_all(self, incident):
        for offer in incident.offers:
            if offer.status == "pending":
                offer.expires_at = datetime.utcnow() - timedelta(seconds=1)
        self.db.commit()

    def test_moves_to_next_nearest_when_window_lapses(self):
        incident = make_incident(self.db)
        offer = offers.open_case(self.db, incident)[0]
        self._expire(offer)
        offers.escalate_once(self.db)
        pending = [o for o in incident.offers if o.status == "pending"]
        self.assertEqual(len(pending), 1)
        self.assertNotEqual(pending[0].hospital_id, offer.hospital_id)
        self.assertEqual(offer.status, "expired")

    def test_broadcasts_to_everyone_after_stages(self):
        incident = make_incident(self.db)
        offers.open_case(self.db, incident)
        for _ in range(3):
            self._expire_all(incident)
            offers.escalate_once(self.db)
        broadcast = [o for o in incident.offers if o.stage == offers.BROADCAST_STAGE]
        self.assertTrue(broadcast)
        self.assertTrue(incident.broadcast_open)

    def test_unclaimed_broadcast_closes_out(self):
        incident = make_incident(self.db)
        offers.open_case(self.db, incident)
        for _ in range(8):
            self._expire_all(incident)
            offers.escalate_once(self.db)
            offers.expire_lapsed_broadcasts(self.db)
            self.db.refresh(incident)
            if incident.status == "cancelled":
                break
        self.assertEqual(incident.status, "cancelled")


class AcceptTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.near, self.mid, self.far = seed(self.db)

    def test_accept_claims_case_and_supersedes_rivals(self):
        incident = make_incident(self.db)
        offers.open_case(self.db, incident)
        extra = offers._offer_to(self.db, incident, self.far, 5000, stage=2, window_minutes=10)
        self.db.commit()

        offers.accept(self.db, incident, self.near, USER)
        self.db.refresh(incident)

        self.assertEqual(incident.hospital_id, self.near.id)
        self.assertEqual(incident.accepted_by, USER.email)
        self.assertIsNotNone(incident.eta_scene_seconds)
        self.assertNotIn("pending", {o.status for o in incident.offers})
        self.assertEqual(extra.status, "superseded")

    def test_accept_without_offer_is_rejected(self):
        incident = make_incident(self.db)
        offers.open_case(self.db, incident)
        with self.assertRaises(offers.OfferError):
            offers.accept(self.db, incident, self.far, USER)

    def test_accept_expires_after_window(self):
        incident = make_incident(self.db)
        offer = offers.open_case(self.db, incident)[0]
        offer.expires_at = datetime.utcnow() - timedelta(seconds=1)
        self.db.commit()
        with self.assertRaises(offers.OfferError):
            offers.accept(self.db, incident, self.near, USER)

    def test_accepting_reserves_an_ambulance(self):
        incident = make_incident(self.db)
        offers.open_case(self.db, incident)
        before = self.near.ambulances_available
        offers.accept(self.db, incident, self.near, USER)
        dispatch.sync_availability(self.db, self.near)
        self.assertLess(self.near.ambulances_available, before)
        self.assertTrue(any(a.incident_id == incident.id for a in self.near.ambulances))


class IntakeTest(unittest.IsolatedAsyncioTestCase):
    async def test_create_case_offers_to_nearest(self):
        db = make_db()
        near, mid, far = seed(db)
        incident = await intake.create_case(
            db,
            {
                "severity": 4.0,
                "location": {"lat": 30.0400, "lon": 31.2400},
                "occurred_at": "2026-01-01T10:00:00Z",
                "patient": {"name": "Test Patient", "age": 40, "blood_type": "O+"},
            },
        )
        self.assertEqual(incident.status, "contacts_notified")
        self.assertEqual(incident.patient.full_name, "Test Patient")
        self.assertIsNotNone(incident.occurred_at)
        offers_pending = [o for o in incident.offers if o.status == "pending"]
        self.assertEqual(len(offers_pending), 1)
        self.assertEqual(offers_pending[0].hospital_id, near.id)

    async def test_accept_then_cancel_frees_resources(self):
        db = make_db()
        near, mid, far = seed(db)
        incident = await intake.create_case(
            db, {"severity": 6.0, "location": {"lat": 30.0400, "lon": 31.2400}}
        )
        user = SimpleNamespace(email="dispatch@near.test")
        await intake.accept_case(db, incident, near, user)
        self.assertEqual(incident.status, "ambulance_assigned")

        await intake.cancel_case(db, incident, near)
        db.refresh(incident)
        self.assertEqual(incident.status, "cancelled")
        self.assertTrue(all(a.incident_id is None for a in incident.ambulances))


if __name__ == "__main__":
    unittest.main()

import unittest
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models, security
from app.deps import visible_hospital
from app.services import dispatch


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


class PasswordTest(unittest.TestCase):
    def test_password_round_trips(self):
        salt, digest = security.hash_password("correct horse battery")
        self.assertTrue(security.verify_password("correct horse battery", salt, digest))

    def test_wrong_password_is_rejected(self):
        salt, digest = security.hash_password("correct horse battery")
        self.assertFalse(security.verify_password("wrong password", salt, digest))

    def test_same_password_gets_different_salt(self):
        first = security.hash_password("same-password")
        second = security.hash_password("same-password")
        self.assertNotEqual(first[0], second[0])
        self.assertNotEqual(first[1], second[1])

    def test_malformed_salt_is_rejected_not_crashed(self):
        self.assertFalse(security.verify_password("x", "not-hex", "deadbeef"))


class TokenTest(unittest.TestCase):
    def test_token_is_stored_hashed(self):
        raw, hashed = security.new_token()
        self.assertNotEqual(raw, hashed)
        self.assertEqual(security.hash_token(raw), hashed)
        self.assertTrue(security.token_matches(raw, hashed))

    def test_other_token_does_not_match(self):
        _, hashed = security.new_token()
        other, _ = security.new_token()
        self.assertFalse(security.token_matches(other, hashed))


class RoleTest(unittest.TestCase):
    def test_rank_ordering(self):
        self.assertTrue(security.require_role("admin", "dispatcher"))
        self.assertTrue(security.require_role("dispatcher", "viewer"))
        self.assertFalse(security.require_role("viewer", "dispatcher"))
        self.assertFalse(security.require_role("dispatcher", "admin"))

    def test_unknown_role_never_passes(self):
        self.assertFalse(security.require_role("ghost", "viewer"))


class VisibilityTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        a = models.Hospital(code="a", name="A", lat=30.04, lon=31.24, beds_total=2, ambulances_total=1)
        b = models.Hospital(code="b", name="B", lat=30.05, lon=31.25, beds_total=2, ambulances_total=1)
        self.db.add_all([a, b])
        self.db.commit()
        dispatch.resize_fleet(self.db, a, 1)
        dispatch.resize_fleet(self.db, b, 1)
        self.db.commit()
        self.a, self.b = a, b

    def test_owner_can_see_its_case(self):
        incident = models.Incident(alert_id="x", trip_id="t", severity=6, lat=30.04, lon=31.24,
                                   hospital_id=self.a.id)
        self.db.add(incident)
        self.db.commit()
        self.assertEqual(visible_hospital(self.db, "x", self.a).id, incident.id)

    def test_other_hospital_cannot_see_a_case_it_was_not_offered(self):
        incident = models.Incident(alert_id="y", trip_id="t", severity=6, lat=30.04, lon=31.24,
                                   hospital_id=self.a.id)
        self.db.add(incident)
        self.db.commit()
        with self.assertRaises(HTTPException):
            visible_hospital(self.db, "y", self.b)

    def test_hospital_with_a_pending_offer_can_see_the_case(self):
        incident = models.Incident(alert_id="z", trip_id="t", severity=6, lat=30.04, lon=31.24)
        self.db.add(incident)
        self.db.commit()
        self.db.add(models.CaseOffer(incident_id=incident.id, hospital_id=self.b.id, stage=1,
                                     status="pending", expires_at=datetime.utcnow() + timedelta(hours=1)))
        self.db.commit()
        self.assertEqual(visible_hospital(self.db, "z", self.b).id, incident.id)

    def test_expired_offer_hides_the_case(self):
        incident = models.Incident(alert_id="w", trip_id="t", severity=6, lat=30.04, lon=31.24)
        self.db.add(incident)
        self.db.commit()
        self.db.add(models.CaseOffer(incident_id=incident.id, hospital_id=self.b.id, stage=1,
                                     status="pending", expires_at=datetime.utcnow() - timedelta(minutes=1)))
        self.db.commit()
        with self.assertRaises(HTTPException):
            visible_hospital(self.db, "w", self.b)


if __name__ == "__main__":
    unittest.main()

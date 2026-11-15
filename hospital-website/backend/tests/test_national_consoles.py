"""The split between the two national consoles.

The authority sees the live national picture — every hospital, open case and
ambulance — because that is oversight. The platform admin only manages the
hospital registry, so its payload deliberately carries no cases and no fleet.
These tests pin that shape down from both sides: what the authority endpoint
hands out, and what the platform endpoint must not hand out.
"""

import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.routers import auth

REVIEW_KEY = "test-review-key"


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def user_for(db, email, role="authority"):
    row = models.User(
        hospital_id=None,
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash="x",
        password_salt="y",
        role=role,
    )
    db.add(row)
    db.commit()
    return row


def seed_nation(db):
    hospital = models.Hospital(
        code="national-1",
        name="National General",
        lat=30.04,
        lon=31.24,
        beds_total=20,
        ambulances_total=3,
    )
    db.add(hospital)
    db.flush()

    open_case = models.Incident(
        alert_id="a-open", trip_id="t", severity=8, lat=30.04, lon=31.24,
        hospital_id=hospital.id, status="on_scene",
    )
    db.add(open_case)
    db.add(
        models.Ambulance(
            hospital_id=hospital.id, code="amb-1", status="en_route", lat=30.04, lon=31.24
        )
    )
    db.add(
        models.HospitalClaim(
            name="New Hospital",
            name_normalized="new hospital",
            governorate="Cairo",
            claimed_by_email="new@example.com",
            claimed_by_name="Someone",
            reviewed_at=None,
        )
    )
    db.add(
        models.RegistryHospital(
            name="Unclaimed General",
            name_normalized="unclaimed general",
            governorate="Cairo",
            lat=30.05,
            lon=31.25,
        )
    )
    db.commit()
    return hospital, open_case


class AuthorityViewTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital, self.open_case = seed_nation(self.db)
        self.authority = user_for(self.db, "gov@egypt.example", role="authority")
        self.staff = user_for(self.db, "staff@tanta.example", role="staff")

    def test_only_authority_accounts_pass_the_gate(self):
        self.assertEqual(auth._require_authority(self.authority).id, self.authority.id)
        with self.assertRaises(HTTPException) as caught:
            auth._require_authority(self.staff)
        self.assertEqual(caught.exception.status_code, 403)

    def test_overview_carries_hospitals_cases_and_ambulances(self):
        payload = auth.authority_overview(self.db, self.authority)
        for key in ("hospitals", "ambulances", "incidents", "generated_at"):
            self.assertIn(key, payload)
        self.assertEqual({row["alert_id"] for row in payload["incidents"]}, {"a-open"})
        self.assertEqual(payload["hospitals"][0]["name"], "National General")
        self.assertEqual(payload["ambulances"][0]["ambulance_id"], "amb-1")
        self.assertTrue(all(row["claimed"] for row in payload["hospitals"]))

    def test_overview_can_include_unclaimed_registry_entries_for_review(self):
        payload = auth.authority_overview(
            self.db, self.authority, include_unclaimed=True
        )
        unclaimed = [row for row in payload["hospitals"] if row["claimed"] is False]
        self.assertEqual([row["name"] for row in unclaimed], ["Unclaimed General"])

    def test_overview_is_wired_to_the_authority_gate(self):
        """The endpoint must run every caller through _require_authority."""
        self.assertIn(auth._require_authority, self._dependencies(auth.authority_overview))
        self.assertIn(auth._require_authority, self._dependencies(auth.authority_incident_details))

    def test_case_detail_includes_the_timeline(self):
        detail = auth.authority_incident_details("a-open", self.db, self.authority)
        self.assertEqual(detail["alert_id"], "a-open")
        self.assertIn("events", detail)

    @staticmethod
    def _dependencies(func):
        """Every dependency function declared on the endpoint's parameters."""
        return {
            param.dependency
            for param in (getattr(func, "__defaults__", ()) or ())
            if getattr(param, "dependency", None)
        }

    def test_unknown_case_detail_is_404(self):
        with self.assertRaises(HTTPException) as caught:
            auth.authority_incident_details("nope", self.db, self.authority)
        self.assertEqual(caught.exception.status_code, 404)


class PlatformRegistryTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        seed_nation(self.db)

    def test_registry_carries_hospitals_and_claims(self):
        payload = auth.platform_registry(self.db)
        for key in ("hospitals", "pending_claims", "generated_at"):
            self.assertIn(key, payload)
        self.assertEqual(payload["pending_claims"][0]["name"], "New Hospital")

    def test_registry_hands_out_no_cases_and_no_fleet(self):
        """Platform management must not become a back door to live data."""
        payload = auth.platform_registry(self.db)
        self.assertNotIn("incidents", payload)
        self.assertNotIn("ambulances", payload)

    def test_full_review_overview_is_unchanged_for_the_admin_console(self):
        payload = auth.platform_overview(self.db)
        for key in ("hospitals", "ambulances", "incidents", "pending_claims"):
            self.assertIn(key, payload)


if __name__ == "__main__":
    unittest.main()

"""Onboarding and invitations.

The property under test throughout: a hospital gets exactly one account, an
account exists only for an invited address, and nobody can grant themselves a
role or a hospital by calling an endpoint.
"""

import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app import models, security
from app.domain.naming import normalize
from app.routers import auth
from app.services import hospital_registry
from app.services.hospital_seed import SEED_REGISTRY


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def credentials(email="admin@tanta.example", password="longenoughpassword"):
    return auth.Credentials(email=email, password=password, full_name="Test Admin")


def entry_for(db, name):
    return db.query(models.RegistryHospital).filter(
        models.RegistryHospital.name_normalized == normalize(name)
    ).one()


class RegistryLookupTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)

    def test_search_is_public_and_finds_by_alias(self):
        result = auth.search_registry(q="kasr el ainy", governorate=None, limit=20, db=self.db)
        self.assertEqual(result["results"][0]["name"], "Cairo University Hospital")

    def test_results_report_whether_a_hospital_is_taken(self):
        """A hospital needs to know before typing a password, not after."""
        entry = entry_for(self.db, "Tanta University Hospital")
        self.assertFalse(auth.search_registry(q="tanta university", governorate=None, limit=20, db=self.db)["results"][0]["claimed"])

        self.db.add(
            models.Hospital(
                code="t", name=entry.name, lat=30.78, lon=30.99, registry_id=entry.id
            )
        )
        self.db.commit()
        self.assertTrue(auth.search_registry(q="tanta university", governorate=None, limit=20, db=self.db)["results"][0]["claimed"])

    def test_results_expose_no_accounts_or_cases(self):
        self.db.add(
            models.Hospital(code="t", name="Tanta", lat=30.78, lon=30.99, beds_total=4)
        )
        self.db.commit()
        result = auth.search_registry(q="tanta", governorate=None, limit=20, db=self.db)
        blob = str(result).lower()
        for leaked in ("password", "token", "riverside@", "staff"):
            self.assertNotIn(leaked, blob)

    def test_governorates_are_offered_for_the_claim_form(self):
        self.assertIn("Luxor", auth.search_registry(q="", governorate=None, limit=20, db=self.db)["governorates"])


class JoinTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)
        self.db.execute(
            text(
                "UPDATE registry_hospitals SET lat = 30.78, lon = 30.99 "
                "WHERE name_normalized = 'tanta university hospital'"
            )
        )
        self.db.commit()
        self.db.expire_all()
        self.entry = entry_for(self.db, "Tanta University Hospital")
        self.entry_id = self.entry.id

    def join(self, **overrides):
        payload = {
            "registry_id": self.entry.id,
            "admin": credentials(),
            "trauma_level": 2,
            "ambulances_total": 3,
            "beds_total": 20,
        }
        payload.update(overrides)
        return auth.join_hospital(auth.HospitalJoin(**payload), db=self.db)

    def test_joining_creates_a_tenant_and_an_admin(self):
        result = self.join()
        self.assertEqual(result["user"]["role"], "admin")
        self.assertEqual(result["hospital"]["name"], "Tanta University Hospital")
        self.assertEqual(result["hospital"]["ambulances_total"], 3)

    def test_tenant_records_the_registry_entry_it_claimed(self):
        self.join()
        hospital = self.db.query(models.Hospital).one()
        self.assertEqual(hospital.registry_id, self.entry.id)
        self.assertEqual(hospital.code, self.db.query(models.Hospital).one().code)

    def test_fleet_is_created_from_the_joined_fleet_size(self):
        self.join(ambulances_total=4)
        self.assertEqual(self.db.query(models.Ambulance).count(), 4)

    def test_second_join_for_the_same_hospital_is_refused(self):
        self.join()
        with self.assertRaises(HTTPException) as caught:
            self.join(admin=credentials(email="second@tanta.example"))
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("invitation", caught.exception.detail.lower())
        self.assertEqual(self.db.query(models.Hospital).count(), 1)

    def test_reused_admin_email_is_refused(self):
        self.join()
        other = entry_for(self.db, "Luxor University Hospital")
        with self.assertRaises(HTTPException) as caught:
            auth.join_hospital(
                auth.HospitalJoin(registry_id=other.id, admin=credentials()),
                db=self.db,
            )
        self.assertEqual(caught.exception.status_code, 409)

    def test_same_name_under_another_entry_is_still_refused(self):
        """A duplicate reached by a different registry row is still a duplicate.

        The registry is not a reliable identity system on its own, so the join
        also checks the same name in other governorates and a nearby point.
        """
        self.join()
        # A second registry row for the same hospital, in another governorate.
        twin = models.RegistryHospital(
            name="Tanta University Hospital",
            name_normalized=normalize("Tanta University Hospital"),
            governorate="Beheira",
            lat=30.9,
            lon=31.2,
        )
        self.db.add(twin)
        self.db.commit()

        with self.assertRaises(HTTPException) as caught:
            auth.join_hospital(
                auth.HospitalJoin(registry_id=twin.id, admin=credentials(email="other@tanta.example")),
                db=self.db,
            )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.db.query(models.Hospital).count(), 1)

    def test_location_overlapping_a_claimed_hospital_is_refused(self):
        """Two tenants metres apart would double-dispatch the same ambulance."""
        self.join()
        neighbour = self.db.query(models.RegistryHospital).filter(
            models.RegistryHospital.governorate == "Giza"
        ).first()
        neighbour.lat, neighbour.lon = 30.78005, 30.99005
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            auth.join_hospital(
                auth.HospitalJoin(registry_id=neighbour.id, admin=credentials(email="two@tanta.example")),
                db=self.db,
            )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.db.query(models.Hospital).count(), 1)

    def test_entry_without_a_location_demands_one(self):
        self.db.execute(text("UPDATE registry_hospitals SET lat = NULL, lon = NULL"))
        self.db.commit()
        self.db.expire_all()
        with self.assertRaises(HTTPException) as caught:
            self.join()
        self.assertEqual(caught.exception.status_code, 422)

    def test_supplied_location_is_used_when_the_entry_has_none(self):
        self.db.execute(
            text("UPDATE registry_hospitals SET lat = NULL, lon = NULL WHERE id = :i"),
            {"i": self.entry.id},
        )
        self.db.commit()
        self.db.expire_all()
        self.join(lat=30.79, lon=31.0)
        self.assertEqual(self.db.query(models.Hospital).one().registry_id, self.entry_id)

    def test_unknown_registry_id_is_a_404(self):
        with self.assertRaises(HTTPException) as caught:
            auth.join_hospital(
                auth.HospitalJoin(registry_id=999999, admin=credentials()), db=self.db
            )
        self.assertEqual(caught.exception.status_code, 404)

    def test_available_cannot_exceed_total(self):
        self.join(ambulances_total=2, ambulances_available=9)
        self.assertLessEqual(
            self.db.query(models.Hospital).one().ambulances_available,
            self.db.query(models.Hospital).one().ambulances_total,
        )

    def test_registration_no_longer_takes_a_free_text_name(self):
        """The old endpoint accepted any name, which was the whole problem."""
        fields = set(auth.HospitalJoin.model_fields)
        self.assertNotIn("name", fields)
        self.assertIn("registry_id", fields)


class ClaimTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        hospital_registry.seed_registry(self.db, SEED_REGISTRY)

    def claim(self, **overrides):
        payload = {
            "name": "New Valley General Hospital",
            "governorate": "New Valley",
            "lat": 25.4,
            "lon": 30.6,
            "claimed_by_name": "Dr Amr",
            "email": "amr@hospital.example",
        }
        payload.update(overrides)
        return auth.submit_claim(auth.HospitalClaimRequest(**payload), db=self.db)

    def test_claim_is_queued_not_granted(self):
        result = self.claim()
        self.assertEqual(result["status"], "pending_review")
        self.assertEqual(self.db.query(models.Hospital).count(), 0)
        self.assertEqual(self.db.query(models.HospitalClaim).count(), 1)

    def test_claiming_a_listed_hospital_points_at_the_joiner_flow(self):
        result = self.claim(name="Tanta University Hospital", governorate="Gharbia")
        self.assertEqual(result["status"], "already_listed")
        self.assertEqual(self.db.query(models.HospitalClaim).count(), 0)

    def test_repeat_claim_does_not_queue_twice(self):
        self.claim()
        result = self.claim()
        self.assertEqual(result["status"], "already_pending")
        self.assertEqual(self.db.query(models.HospitalClaim).count(), 1)

    def test_unknown_governorate_is_rejected(self):
        with self.assertRaises(ValueError):
            self.claim(governorate="Atlantis")

    def test_review_can_convert_a_claim_into_a_registry_entry(self):
        self.claim()
        claim = self.db.query(models.HospitalClaim).one()
        self.assertTrue(claim.is_pending)


class InvitationTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = models.Hospital(
            code="h-1", name="Tanta University Hospital", lat=30.78, lon=30.99,
            beds_total=10, ambulances_total=2,
        )
        self.db.add(self.hospital)
        self.db.commit()
        salt, digest = security.hash_password("adminpassword")
        self.admin = models.User(
            hospital_id=self.hospital.id,
            email="admin@tanta.example",
            full_name="Admin",
            password_hash=digest,
            password_salt=salt,
            role="admin",
        )
        self.db.add(self.admin)
        self.db.commit()

    def invite(self, email="dispatch@tanta.example", role="dispatcher", mail_ok=True):
        with patch.object(auth.mail, "send", return_value=mail_ok):
            return auth.invite_staff(
                auth.InvitationCreate(email=email, role=role), admin=self.admin, db=self.db
            )

    def token_from(self, result):
        return result["invite_link"].rsplit("/", 1)[-1]

    def test_invite_creates_no_account(self):
        """The account must not exist until the recipient sets a password."""
        self.invite()
        self.assertEqual(self.db.query(models.User).count(), 1)
        self.assertEqual(self.db.query(models.StaffInvitation).count(), 1)

    def test_invite_is_bound_to_the_invited_address(self):
        result = self.invite()
        row = self.db.query(models.StaffInvitation).one()
        self.assertEqual(row.email, "dispatch@tanta.example")
        self.assertEqual(row.hospital_id, self.hospital.id)
        self.assertEqual(result["status"], "pending")

    def test_raw_token_is_not_stored(self):
        """A database dump must not hand over usable invitations."""
        result = self.invite()
        row = self.db.query(models.StaffInvitation).one()
        self.assertNotIn(self.token_from(result), [row.token_hash])
        self.assertEqual(len(row.token_hash), 64)

    def test_accepting_creates_the_account_with_the_invited_email(self):
        token = self.token_from(self.invite())
        result = auth.accept_invitation(
            token, auth.InvitationAccept(password="chosenpassword", full_name="New Dispatcher"),
            db=self.db,
        )
        self.assertEqual(result["user"]["email"], "dispatch@tanta.example")
        self.assertEqual(result["user"]["role"], "dispatcher")
        self.assertIsNotNone(result["token"])

    def test_recipient_sets_their_own_password(self):
        token = self.token_from(self.invite())
        auth.accept_invitation(token, auth.InvitationAccept(password="mypassword123"), db=self.db)
        user = self.db.query(models.User).filter(
            models.User.email == "dispatch@tanta.example"
        ).one()
        self.assertTrue(security.verify_password("mypassword123", user.password_salt, user.password_hash))

    def test_invitation_cannot_be_reused(self):
        token = self.token_from(self.invite())
        auth.accept_invitation(token, auth.InvitationAccept(password="mypassword123"), db=self.db)
        with self.assertRaises(HTTPException) as caught:
            auth.accept_invitation(token, auth.InvitationAccept(password="another12345"), db=self.db)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(self.db.query(models.User).count(), 2)

    def test_expired_invitation_is_refused(self):
        token = self.token_from(self.invite())
        self.db.query(models.StaffInvitation).one().expires_at = datetime.utcnow() - timedelta(minutes=1)
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            auth.accept_invitation(token, auth.InvitationAccept(password="mypassword123"), db=self.db)
        self.assertEqual(caught.exception.status_code, 410)

    def test_revoked_invitation_is_refused(self):
        token = self.token_from(self.invite())
        row = self.db.query(models.StaffInvitation).one()
        auth.revoke_invitation(row.id, admin=self.admin, db=self.db)
        with self.assertRaises(HTTPException) as caught:
            auth.accept_invitation(token, auth.InvitationAccept(password="mypassword123"), db=self.db)
        self.assertEqual(caught.exception.status_code, 410)
        self.assertEqual(self.db.query(models.User).count(), 1)

    def test_invitation_email_cannot_be_overridden_by_the_recipient(self):
        """A forwarded link must not mint an account for a different address.

        An `email` field on the accept payload is ignored, because the email
        is read from the invitation and never from the request.
        """
        token = self.token_from(self.invite())
        auth.accept_invitation(
            token,
            auth.InvitationAccept(password="mypassword123", email="attacker@evil.example"),
            db=self.db,
        )
        emails = {u.email for u in self.db.query(models.User).all()}
        self.assertNotIn("attacker@evil.example", emails)
        self.assertIn("dispatch@tanta.example", emails)

    def test_garbage_token_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            auth.accept_invitation("not-a-real-token", auth.InvitationAccept(password="mypassword123"), db=self.db)
        self.assertEqual(caught.exception.status_code, 404)

    def test_preview_shows_the_hospital_without_a_token(self):
        token = self.token_from(self.invite())
        preview = auth.preview_invitation(token, db=self.db)
        self.assertEqual(preview["hospital"], "Tanta University Hospital")
        self.assertEqual(preview["role"], "dispatcher")

    def test_short_password_is_rejected(self):
        with self.assertRaises(ValueError):
            auth.InvitationAccept(password="short")

    def test_duplicate_pending_invitation_is_refused(self):
        self.invite()
        with self.assertRaises(HTTPException) as caught:
            self.invite()
        self.assertEqual(caught.exception.status_code, 409)

    def test_reinviting_after_acceptance_is_refused_as_existing_account(self):
        self.invite()
        token = self.token_from({"invite_link": "x"})
        row = self.db.query(models.StaffInvitation).one()
        row.accepted_at = datetime.utcnow()
        self.db.add(
            models.User(
                hospital_id=self.hospital.id, email="dispatch@tanta.example", full_name="D",
                password_hash="x", password_salt="y", role="dispatcher",
            )
        )
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            self.invite()
        self.assertEqual(caught.exception.status_code, 409)

    def test_admin_cannot_grant_a_role_above_their_own(self):
        dispatcher = models.User(
            hospital_id=self.hospital.id, email="d@tanta.example", full_name="D",
            password_hash="x", password_salt="y", role="dispatcher",
        )
        self.db.add(dispatcher)
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            auth.invite_staff(
                auth.InvitationCreate(email="new@tanta.example", role="admin"),
                admin=dispatcher, db=self.db,
            )
        self.assertEqual(caught.exception.status_code, 403)

    def test_mail_failure_is_reported_not_hidden(self):
        result = self.invite(mail_ok=False)
        self.assertFalse(result["mail_sent"])
        self.assertTrue(result["invite_link"])


if __name__ == "__main__":
    unittest.main()

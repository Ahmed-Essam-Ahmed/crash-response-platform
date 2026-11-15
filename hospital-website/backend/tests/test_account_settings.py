"""Account settings and hospital profile.

Three endpoints, each with a different trust level:

- a person edits their own name and email, but never their role
- a person changes their own password, and every other session dies with it
- the hospital profile is edited only with the hospital admin password,
  because its fields are what dispatch routes ambulances on

The tests assert the boundaries, not just the happy paths.
"""

import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models, security
from app.routers import auth, me


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def make_hospital(db, code="riverside-trauma-centre"):
    hospital = models.Hospital(
        code=code,
        name="Riverside Trauma Centre",
        lat=30.048,
        lon=31.232,
        address="Riverside, Cairo",
        trauma_level=3,
        beds_total=12,
        admin_password_hash="x",
        admin_password_salt="y",
    )
    db.add(hospital)
    db.flush()
    return hospital


def make_user(db, hospital, email="nurse@demo.hospital", password="hospital123"):
    salt, digest = security.hash_password(password)
    user = models.User(
        hospital_id=hospital.id if hospital else None,
        email=email,
        full_name="Demo Nurse",
        password_hash=digest,
        password_salt=salt,
        role="staff",
    )
    db.add(user)
    db.commit()
    return user


class ProfileUpdateTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = make_hospital(self.db)
        self.user = make_user(self.db, self.hospital)

    def test_name_can_be_changed(self):
        payload = auth.ProfileUpdate(full_name="Renamed Person")
        result = auth.update_profile(payload, self.user, self.db)
        self.assertEqual(result["user"]["full_name"], "Renamed Person")

    def test_email_is_normalised(self):
        payload = auth.ProfileUpdate(email="  New.Email@Demo.Hospital ")
        result = auth.update_profile(payload, self.user, self.db)
        self.assertEqual(result["user"]["email"], "new.email@demo.hospital")

    def test_duplicate_email_is_rejected(self):
        make_user(self.db, self.hospital, email="taken@demo.hospital")
        payload = auth.ProfileUpdate(email="taken@demo.hospital")
        with self.assertRaises(HTTPException) as caught:
            auth.update_profile(payload, self.user, self.db)
        self.assertEqual(caught.exception.status_code, 409)

    def test_role_is_never_writable(self):
        """The payload has no role field, so a crafted body cannot escalate."""
        payload = auth.ProfileUpdate.model_validate(
            {"full_name": "Someone", "role": "authority"}
        )
        auth.update_profile(payload, self.user, self.db)
        self.db.refresh(self.user)
        self.assertEqual(self.user.role, "staff")


class PasswordChangeTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = make_hospital(self.db)
        self.user = make_user(self.db, self.hospital, password="correct-horse-1")

    def test_current_password_must_be_correct(self):
        payload = auth.PasswordChange(
            current_password="wrong-password", new_password="a-brand-new-pass"
        )
        with self.assertRaises(HTTPException) as caught:
            auth.change_password(payload, self.user, self.db)
        self.assertEqual(caught.exception.status_code, 400)

    def test_password_is_replaced(self):
        payload = auth.PasswordChange(
            current_password="correct-horse-1", new_password="a-brand-new-pass"
        )
        auth.change_password(payload, self.user, self.db)
        self.db.refresh(self.user)
        self.assertTrue(
            security.verify_password(
                "a-brand-new-pass", self.user.password_salt, self.user.password_hash
            )
        )
        self.assertFalse(
            security.verify_password(
                "correct-horse-1", self.user.password_salt, self.user.password_hash
            )
        )

    def test_other_sessions_are_revoked(self):
        from datetime import datetime, timedelta

        raw, hashed = security.new_token()
        self.db.add(
            models.AuthToken(
                user_id=self.user.id,
                token_hash=hashed,
                expires_at=datetime.utcnow() + timedelta(hours=1),
                revoked_at=None,
            )
        )
        self.db.commit()

        payload = auth.PasswordChange(
            current_password="correct-horse-1", new_password="a-brand-new-pass"
        )
        auth.change_password(payload, self.user, self.db)

        token = (
            self.db.query(models.AuthToken).filter(models.AuthToken.token_hash == hashed).one()
        )
        self.assertIsNotNone(token.revoked_at)

    def test_short_new_password_is_refused(self):
        with self.assertRaises(Exception):
            auth.PasswordChange(current_password="correct-horse-1", new_password="short")


class HospitalProfileTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = make_hospital(self.db)
        self.user = make_user(self.db, self.hospital)

    def test_profile_fields_are_updated(self):
        payload = me.HospitalProfileUpdate(
            name="Riverside Trauma & Burns",
            trauma_level=4,
            address="New address, Cairo",
        )
        import asyncio

        result = asyncio.run(
            me.update_hospital_profile(payload, self.user, self.db)
        )
        self.assertEqual(result["name"], "Riverside Trauma & Burns")
        self.assertEqual(result["trauma_level"], 4)
        self.assertEqual(result["address"], "New address, Cairo")

    def test_partial_update_leaves_other_fields_alone(self):
        payload = me.HospitalProfileUpdate(name="Renamed Only")
        import asyncio

        result = asyncio.run(me.update_hospital_profile(payload, self.user, self.db))
        self.assertEqual(result["address"], "Riverside, Cairo")
        self.assertEqual(result["lat"], 30.048)

    def test_coordinates_are_validated(self):
        with self.assertRaises(Exception):
            me.HospitalProfileUpdate(lat=999.0)

    def test_endpoint_is_gated_by_admin_password(self):
        """Every dependency declared on the endpoint must include the gate."""
        deps = {
            param.dependency
            for param in (getattr(me.update_hospital_profile, "__defaults__", ()) or ())
            if getattr(param, "dependency", None)
        }
        from app.deps import require_admin_password

        self.assertIn(require_admin_password, deps)


if __name__ == "__main__":
    unittest.main()

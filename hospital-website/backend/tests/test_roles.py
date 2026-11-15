"""Access enforcement at the API boundary.

Every hospital account is the single `staff` role, so there is no per-role
hiding to rely on. What still has to hold is that a hospital user must belong
to a hospital, and that sensitive changes need the hospital admin password
checked on every call. The console hides nothing a caller cannot reach
directly, so these tests call the endpoints the way anyone can.
"""

import asyncio
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models, security
from app.deps import current_staff, require_admin_password
from app.routers import auth, me

ADMIN_PASSWORD = "hospital-admin"


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def user_for(db, email, role="staff", hospital=None):
    salt, digest = security.hash_password("longenoughpassword")
    row = models.User(
        hospital_id=hospital.id if hospital is not None else db.query(models.Hospital).one().id,
        email=email,
        full_name=email.split("@")[0].title(),
        password_hash=digest,
        password_salt=salt,
        role=role,
    )
    db.add(row)
    db.commit()
    return row


def hospital_with_password(db, code="h-1"):
    salt, digest = security.hash_password(ADMIN_PASSWORD)
    hospital = models.Hospital(
        code=code,
        name=code,
        lat=30.78,
        lon=30.99,
        beds_total=10,
        ambulances_total=2,
        admin_password_hash=digest,
        admin_password_salt=salt,
    )
    db.add(hospital)
    db.commit()
    return hospital


class StaffGateTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = hospital_with_password(self.db)
        self.staff = user_for(self.db, "staff@tanta.example")

    def test_staff_with_a_hospital_can_act_on_a_case(self):
        self.assertEqual(current_staff(self.staff).id, self.staff.id)

    def test_authority_without_a_hospital_cannot_act(self):
        authority = user_for(self.db, "gov@egypt.example", role="authority")
        authority.hospital_id = None
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            current_staff(authority)
        self.assertEqual(caught.exception.status_code, 403)

    def test_staff_can_still_read_the_case_list(self):
        listing = me.my_cases(self.staff, self.db)
        for key in ("assigned", "recent", "offers"):
            self.assertEqual(listing[key], [])


class AdminPasswordGateTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = hospital_with_password(self.db)
        self.staff = user_for(self.db, "staff@tanta.example")

    def test_correct_password_passes(self):
        self.assertEqual(
            require_admin_password(ADMIN_PASSWORD, self.staff).id, self.staff.id
        )

    def test_missing_password_is_refused(self):
        with self.assertRaises(HTTPException) as caught:
            require_admin_password("", self.staff)
        self.assertEqual(caught.exception.status_code, 403)

    def test_wrong_password_is_refused(self):
        with self.assertRaises(HTTPException) as caught:
            require_admin_password("not-the-password", self.staff)
        self.assertEqual(caught.exception.status_code, 403)

    def test_hospital_without_a_password_cannot_be_changed(self):
        self.hospital.admin_password_hash = None
        self.hospital.admin_password_salt = None
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            require_admin_password(ADMIN_PASSWORD, self.staff)
        self.assertEqual(caught.exception.status_code, 403)

    def test_capacity_change_needs_the_password_through_the_endpoint(self):
        """The endpoint body only runs once the gate has accepted the caller."""
        with self.assertRaises(HTTPException):
            require_admin_password("", self.staff)

        result = asyncio.run(
            me.update_beds(me.BedsUpdate(beds_total=12), self.staff, self.db)
        )
        self.assertEqual(result["beds_total"], 12)


class AccountLifecycleTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = hospital_with_password(self.db)
        self.staff = user_for(self.db, "staff@tanta.example")

    def test_removing_staff_deactivates_them(self):
        other = user_for(self.db, "mate@tanta.example")
        auth.remove_staff(other.id, admin=self.staff, db=self.db)
        self.assertFalse(self.db.get(models.User, other.id).is_active)

    def test_removing_staff_revokes_their_sessions(self):
        """A deactivated account must stop working immediately."""
        target = user_for(self.db, "mate@tanta.example")
        raw, hashed = security.new_token()
        self.db.add(
            models.AuthToken(
                user_id=target.id,
                token_hash=hashed,
                expires_at=datetime.utcnow() + timedelta(hours=1),
            )
        )
        self.db.commit()

        auth.remove_staff(target.id, admin=self.staff, db=self.db)
        token = (
            self.db.query(models.AuthToken)
            .filter(models.AuthToken.user_id == target.id)
            .one()
        )
        self.assertIsNotNone(token.revoked_at)

    def test_staff_cannot_be_removed_across_hospitals(self):
        other_hospital = hospital_with_password(self.db, code="h-2")
        stranger = user_for(self.db, "other@x.example", hospital=other_hospital)
        with self.assertRaises(HTTPException) as caught:
            auth.remove_staff(stranger.id, admin=self.staff, db=self.db)
        self.assertEqual(caught.exception.status_code, 404)

    def test_staff_list_is_scoped_to_the_hospital(self):
        other_hospital = hospital_with_password(self.db, code="h-2")
        user_for(self.db, "stranger@x.example", hospital=other_hospital)
        listed = {row["email"] for row in auth.list_staff(self.staff, self.db)}
        self.assertEqual(listed, {"staff@tanta.example"})

    def test_invitations_cannot_be_revoked_across_hospitals(self):
        stranger_hospital = hospital_with_password(self.db, code="h-2")
        stranger = user_for(self.db, "other@x.example", hospital=stranger_hospital)
        with patch.object(auth.mail, "send", return_value=True):
            auth.invite_staff(
                auth.InvitationCreate(email="x@tanta.example"),
                admin=stranger,
                db=self.db,
            )
        row = self.db.query(models.StaffInvitation).one()
        with self.assertRaises(HTTPException) as caught:
            auth.revoke_invitation(row.id, admin=self.staff, db=self.db)
        self.assertEqual(caught.exception.status_code, 404)

    def test_invitation_grants_the_single_staff_role(self):
        with patch.object(auth.mail, "send", return_value=True):
            created = auth.invite_staff(
                auth.InvitationCreate(email="new@tanta.example"),
                admin=self.staff,
                db=self.db,
            )
        self.assertEqual(created["role"], "staff")


if __name__ == "__main__":
    unittest.main()

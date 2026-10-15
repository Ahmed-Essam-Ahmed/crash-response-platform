"""Role enforcement at the API boundary.

The console hides controls a viewer cannot use, which is a convenience and
not a control. These tests call the endpoints directly, the way anyone can.
"""

import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models, security
from app.deps import current_admin, current_dispatcher
from app.routers import auth, me
from fastapi import HTTPException


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def user_for(db, role, email):
    hospital = db.query(models.Hospital).one()
    salt, digest = security.hash_password("longenoughpassword")
    row = models.User(
        hospital_id=hospital.id,
        email=email,
        full_name=role.title(),
        password_hash=digest,
        password_salt=salt,
        role=role,
    )
    db.add(row)
    db.commit()
    return row


class RoleGateTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = models.Hospital(
            code="h-1", name="Tanta", lat=30.78, lon=30.99, beds_total=10, ambulances_total=2
        )
        self.db.add(self.hospital)
        self.db.commit()
        self.admin = user_for(self.db, "admin", "admin@tanta.example")
        self.dispatcher = user_for(self.db, "dispatcher", "dispatch@tanta.example")
        self.viewer = user_for(self.db, "viewer", "view@tanta.example")

    def test_viewer_cannot_act_on_a_case(self):
        for needed in (current_dispatcher, current_admin):
            with self.assertRaises(HTTPException) as caught:
                needed(self.viewer)
            self.assertEqual(caught.exception.status_code, 403)

    def test_dispatcher_can_act_but_not_administer(self):
        self.assertEqual(current_dispatcher(self.dispatcher).id, self.dispatcher.id)
        with self.assertRaises(HTTPException):
            current_admin(self.dispatcher)

    def test_admin_passes_every_gate(self):
        self.assertEqual(current_admin(self.admin).id, self.admin.id)
        self.assertEqual(current_dispatcher(self.admin).id, self.admin.id)

    def test_unknown_role_is_refused_at_both_gates(self):
        for gate in (current_dispatcher, current_admin):
            with self.assertRaises(HTTPException):
                gate(models.User(role="superuser", email="x@y.example"))

    def test_viewer_can_still_read_the_case_list(self):
        """Read access is the point of the role, so it must not be blocked."""
        self.assertIsNotNone(self.viewer.hospital)
        listing = me.my_cases(self.viewer, self.db)
        for key in ("assigned", "recent", "offers"):
            self.assertEqual(listing[key], [])

    def test_viewer_cannot_change_capacity(self):
        with self.assertRaises(HTTPException):
            current_admin(self.viewer)


class AccountLifecycleTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        self.hospital = models.Hospital(
            code="h-1", name="Tanta", lat=30.78, lon=30.99, beds_total=10, ambulances_total=2
        )
        self.db.add(self.hospital)
        self.db.commit()
        self.admin = user_for(self.db, "admin", "admin@tanta.example")

    def test_removing_the_last_admin_is_refused(self):
        """Otherwise a hospital can lock everyone out of its own account."""
        with self.assertRaises(HTTPException) as caught:
            auth.remove_staff(self.admin.id, admin=self.admin, db=self.db)
        self.assertEqual(caught.exception.status_code, 409)

    def test_a_second_admin_allows_the_first_to_step_down(self):
        other = user_for(self.db, "admin", "admin2@tanta.example")
        auth.remove_staff(other.id, admin=self.admin, db=self.db)
        self.assertFalse(self.db.get(models.User, other.id).is_active)

    def test_removing_staff_revokes_their_sessions(self):
        """A deactivated account must stop working immediately."""
        target = user_for(self.db, "dispatcher", "dispatch@tanta.example")
        raw, hashed = security.new_token()
        self.db.add(
            models.AuthToken(
                user_id=target.id, token_hash=hashed,
                expires_at=datetime.utcnow() + timedelta(hours=1),
            )
        )
        self.db.commit()

        auth.remove_staff(target.id, admin=self.admin, db=self.db)
        token = self.db.query(models.AuthToken).filter(
            models.AuthToken.user_id == target.id
        ).one()
        self.assertIsNotNone(token.revoked_at)

    def test_staff_cannot_be_removed_across_hospitals(self):
        other_hospital = models.Hospital(
            code="h-2", name="Other", lat=30.80, lon=31.00, beds_total=4, ambulances_total=1
        )
        self.db.add(other_hospital)
        self.db.commit()
        stranger = models.User(
            hospital_id=other_hospital.id, email="other@x.example", full_name="Other",
            password_hash="x", password_salt="y", role="dispatcher",
        )
        self.db.add(stranger)
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:
            auth.remove_staff(stranger.id, admin=self.admin, db=self.db)
        self.assertEqual(caught.exception.status_code, 404)

    def test_staff_list_is_scoped_to_the_hospital(self):
        other_hospital = models.Hospital(
            code="h-2", name="Other", lat=30.80, lon=31.00, beds_total=4, ambulances_total=1
        )
        self.db.add(other_hospital)
        self.db.commit()
        self.db.add(
            models.User(
                hospital_id=other_hospital.id, email="stranger@x.example", full_name="S",
                password_hash="x", password_salt="y", role="admin",
            )
        )
        self.db.commit()
        listed = {row["email"] for row in auth.list_staff(self.admin, self.db)}
        self.assertEqual(listed, {"admin@tanta.example"})

    def test_invitations_cannot_be_revoked_across_hospitals(self):
        stranger_hospital = models.Hospital(
            code="h-2", name="Other", lat=30.80, lon=31.00, beds_total=4, ambulances_total=1
        )
        self.db.add(stranger_hospital)
        self.db.commit()
        stranger_admin = models.User(
            hospital_id=stranger_hospital.id, email="other@x.example", full_name="Other Admin",
            password_hash="x", password_salt="y", role="admin",
        )
        self.db.add(stranger_admin)
        self.db.commit()
        with patch.object(auth.mail, "send", return_value=True):
            auth.invite_staff(
                auth.InvitationCreate(email="x@tanta.example"),
                admin=stranger_admin, db=self.db,
            )
        row = self.db.query(models.StaffInvitation).one()
        with self.assertRaises(HTTPException) as caught:
            auth.revoke_invitation(row.id, admin=self.admin, db=self.db)
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()

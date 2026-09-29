import unittest

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.routers.cases import CasePayload
from app.services import intake


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


class SeverityScaleTest(unittest.TestCase):
    def test_keeps_a_value_inside_one_to_ten(self):
        self.assertEqual(CasePayload(location={"lat": 1, "lon": 2}, severity=8.4).severity, 8.4)

    def test_clamps_a_value_from_the_upstream_twenty_point_scale(self):
        self.assertEqual(CasePayload(location={"lat": 1, "lon": 2}, severity=17.5).severity, 10.0)

    def test_clamps_zero_up_to_one(self):
        self.assertEqual(CasePayload(location={"lat": 1, "lon": 2}, severity=0).severity, 1.0)

    def test_defaults_to_the_middle_of_the_scale(self):
        self.assertEqual(CasePayload(location={"lat": 1, "lon": 2}).severity, 5.0)

    def test_rejects_a_non_numeric_severity(self):
        with self.assertRaises(ValidationError):
            CasePayload(location={"lat": 1, "lon": 2}, severity="high")


class ContactPayloadTest(unittest.TestCase):
    def test_accepts_the_app_shape_and_an_alias(self):
        payload = CasePayload(
            location={"lat": 1, "lon": 2},
            emergency_contacts=[
                {"name": "Hala Fouad", "relation": "sister", "phone": "+201000000001", "primary": True},
                {"full_name": "Karim Fouad", "relationship": "brother", "phone_number": "+201000000002"},
            ],
        )
        self.assertEqual(len(payload.emergency_contacts), 2)

    def test_intake_persists_mechanism_and_contacts(self):
        import asyncio

        db = make_db()
        db.add(
            models.Hospital(
                code="h-1", name="Test", lat=30.048, lon=31.232, trauma_level=3,
                beds_total=9, ambulances_total=2, ambulances_available=2,
            )
        )
        db.commit()

        incident = asyncio.run(
            intake.create_case(
                db,
                {
                    "severity": 9.4,
                    "mechanism": "Head-on collision at a junction; driver trapped by the legs.",
                    "location": {"lat": 30.05, "lon": 31.233},
                    "location_label": "Corniche St",
                    "patient": {"name": "Mona Adel", "age": 34},
                    "emergency_contacts": [
                        {"name": "Hala Fouad", "relation": "sister", "phone": "+201000000001", "primary": True},
                        {"name": "Karim Fouad", "relation": "brother", "phone": "+201000000002"},
                    ],
                },
            )
        )
        db.refresh(incident)

        self.assertEqual(incident.severity, 9.4)
        self.assertIn("Head-on collision", incident.mechanism)
        self.assertEqual(len(incident.contacts), 2)

        first, second = incident.contacts
        self.assertEqual(first.full_name, "Hala Fouad")
        self.assertEqual(first.relation, "sister")
        self.assertTrue(first.is_primary)
        self.assertEqual(second.full_name, "Karim Fouad")
        self.assertFalse(second.is_primary)

    def test_a_case_without_contacts_is_fine(self):
        import asyncio

        db = make_db()
        incident = asyncio.run(
            intake.create_case(db, {"severity": 4.0, "location": {"lat": 30.05, "lon": 31.233}})
        )
        db.refresh(incident)
        self.assertEqual(incident.contacts, [])
        self.assertIsNone(incident.mechanism)

    def test_contacts_are_ordered_as_sent(self):
        db = make_db()
        db.add(models.Hospital(code="h-1", name="T", lat=30.048, lon=31.232, trauma_level=3,
                               beds_total=4, ambulances_total=1, ambulances_available=1))
        db.commit()
        incident = models.Incident(alert_id="a-1", trip_id="t-1", severity=5.0, lat=30.05, lon=31.233)
        db.add(incident)
        db.commit()
        intake.build_contacts(
            db,
            incident,
            {"emergency_contacts": [
                {"name": "First", "phone": "1"},
                {"name": "Second", "phone": "2"},
                {"name": "Third", "phone": "3"},
            ]},
        )
        db.commit()
        db.refresh(incident)
        self.assertEqual([c.full_name for c in incident.contacts], ["First", "Second", "Third"])


class SchemaAliasTest(unittest.TestCase):
    def test_aliases_survive_schema_validation(self):
        from app.routers.cases import CasePayload

        payload = CasePayload(
            location={"lat": 30.05, "lon": 31.23},
            emergency_contacts=[
                {"full_name": "Karim Fouad", "relationship": "brother", "phone_number": "+201000000002"},
                {"name": "Nour Fouad", "mobile": "+201000000003", "is_primary": True},
            ],
        )
        dumped = payload.model_dump()
        first, second = dumped["emergency_contacts"]
        self.assertEqual(first["relationship"], "brother")
        self.assertEqual(first["phone_number"], "+201000000002")
        self.assertEqual(second["mobile"], "+201000000003")
        self.assertTrue(second["is_primary"])

    def test_aliases_reach_stored_contacts_through_the_api_model(self):
        from app.routers.cases import CasePayload

        db = make_db()
        payload = CasePayload(
            location={"lat": 30.05, "lon": 31.233},
            emergency_contacts=[
                {"full_name": "Karim Fouad", "relationship": "brother", "phone_number": "+201000000002"},
            ],
        )
        incident = models.Incident(alert_id="a-3", trip_id="t-3", severity=6.0, lat=30.05, lon=31.233)
        db.add(incident)
        db.commit()
        db.refresh(incident)

        intake.build_contacts(db, incident, payload.model_dump(exclude_none=True))
        db.commit()
        db.refresh(incident)

        contact = incident.contacts[0]
        self.assertEqual(contact.full_name, "Karim Fouad")
        self.assertEqual(contact.relation, "brother")
        self.assertEqual(contact.phone, "+201000000002")
        db.close()


class SerializerTest(unittest.TestCase):
    def test_incident_payload_carries_mechanism_and_contacts(self):
        from app import serializers

        db = make_db()
        incident = models.Incident(
            alert_id="a-2", trip_id="t-2", severity=7.5, lat=30.05, lon=31.233, mechanism="Rear-ended"
        )
        db.add(incident)
        db.commit()
        intake.build_contacts(db, incident, {"emergency_contacts": [{"name": "Nour", "relation": "wife"}]})
        db.commit()
        db.refresh(incident)

        payload = serializers.incident_to_dict(incident, include_events=False)
        self.assertEqual(payload["mechanism"], "Rear-ended")
        self.assertEqual(payload["emergency_contacts"][0]["name"], "Nour")
        self.assertIn("impact", payload)
        db.close()


if __name__ == "__main__":
    unittest.main()

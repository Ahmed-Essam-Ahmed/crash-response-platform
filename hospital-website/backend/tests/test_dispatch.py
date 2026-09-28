import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.domain import geo, triage
from app.domain.triage import Destination
from app.services import dispatch

SCENE = {"lat": 30.0400, "lon": 31.2400}


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def seed(db):
    db.add_all([
        models.Hospital(code="h-1", name="Near Minor", lat=30.0410, lon=31.2410, capacity=2, trauma_level=1),
        models.Hospital(code="h-2", name="Far Trauma", lat=30.0480, lon=31.2320, capacity=5, trauma_level=3),
        models.Hospital(code="h-3", name="Far Minor", lat=30.0300, lon=31.2500, capacity=5, trauma_level=1),
    ])
    for i, pos in enumerate([(30.0410, 31.2410), (30.0420, 31.2420), (30.0300, 31.2500)]):
        db.add(models.Ambulance(code=f"amb-{i}", lat=pos[0], lon=pos[1], status="available", hospital_code="h-1"))
    db.commit()


class TriageTest(unittest.TestCase):
    def test_thresholds(self):
        self.assertIs(triage.destination_for(9.0), Destination.TRAUMA_CENTRE)
        self.assertIs(triage.destination_for(6.0), Destination.MAJOR)
        self.assertIs(triage.destination_for(2.0), Destination.MINOR)

    def test_resources_scale_with_severity(self):
        self.assertEqual(triage.required_resources(9.0)["ambulances"], 2)
        self.assertEqual(triage.required_resources(6.0)["ambulances"], 1)
        self.assertTrue(triage.required_resources(9.0)["trauma_bay"])

    def test_only_level_three_takes_trauma(self):
        self.assertTrue(triage.accepts(3, Destination.TRAUMA_CENTRE))
        self.assertFalse(triage.accepts(2, Destination.TRAUMA_CENTRE))
        self.assertTrue(triage.accepts(1, Destination.MINOR))


class DispatchTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        seed(self.db)

    def test_picks_nearest_hospital_with_free_beds(self):
        chosen = dispatch.select_hospital(self.db, Destination.MINOR, SCENE)
        self.assertEqual(chosen.code, "h-1")

    def test_trauma_case_skips_non_trauma_hospitals(self):
        chosen = dispatch.select_hospital(self.db, Destination.TRAUMA_CENTRE, SCENE)
        self.assertEqual(chosen.code, "h-2")

    def test_falls_back_when_nearest_is_full(self):
        near = self.db.query(models.Hospital).filter(models.Hospital.code == "h-1").first()
        near.current_load = near.capacity
        self.db.commit()
        chosen = dispatch.select_hospital(self.db, Destination.MINOR, SCENE)
        self.assertNotEqual(chosen.code, "h-1")
        self.assertEqual(chosen.code, "h-2")

    def test_ambulances_ranked_by_distance_and_limited(self):
        chosen = dispatch.select_ambulances(self.db, None, SCENE, 2)
        self.assertEqual(len(chosen), 2)
        self.assertEqual(chosen[0].code, "amb-0")
        self.assertLessEqual(
            geo.haversine_m(chosen[0].lat, chosen[0].lon, SCENE["lat"], SCENE["lon"]),
            geo.haversine_m(chosen[1].lat, chosen[1].lon, SCENE["lat"], SCENE["lon"]),
        )

    def test_no_available_ambulance_raises(self):
        for amb in self.db.query(models.Ambulance).all():
            amb.status = "en_route"
        self.db.commit()
        with self.assertRaises(dispatch.NoResource):
            dispatch.select_ambulances(self.db, None, SCENE, 1)

    def test_reserve_and_release_balance_load(self):
        hospital = self.db.query(models.Hospital).filter(models.Hospital.code == "h-1").first()
        ambulances = dispatch.select_ambulances(self.db, hospital, SCENE, 2)
        dispatch.reserve(self.db, hospital, ambulances)
        self.assertEqual(hospital.current_load, 1)
        self.assertTrue(all(not a.is_available for a in ambulances))

        incident = models.Incident(alert_id="a-1", trip_id="t", severity=6, lat=30.04, lon=31.24,
                                   hospital_code="h-1")
        self.db.add(incident)
        self.db.commit()
        for amb in ambulances:
            amb.incident_id = incident.id
        self.db.commit()
        self.db.refresh(incident)
        self.assertEqual(len(incident.ambulances), 2)

        dispatch.release(self.db, incident)
        self.assertEqual(hospital.current_load, 0)
        self.assertTrue(all(a.is_available for a in ambulances))

    def test_eta_scales_with_distance(self):
        near = geo.eta_seconds(geo.haversine_m(30.040, 31.240, 30.041, 31.241))
        far = geo.eta_seconds(geo.haversine_m(30.030, 31.230, 30.050, 31.250))
        self.assertLess(near, far)


if __name__ == "__main__":
    unittest.main()

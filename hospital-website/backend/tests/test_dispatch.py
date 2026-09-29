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
        models.Hospital(code="h-1", name="Near Minor", lat=30.0410, lon=31.2410, trauma_level=1,
                        beds_total=4, ambulances_total=3),
        models.Hospital(code="h-2", name="Far Trauma", lat=30.0480, lon=31.2320, trauma_level=3,
                        beds_total=5, ambulances_total=2),
    ])
    db.commit()

    near = db.query(models.Hospital).filter_by(code="h-1").first()
    far = db.query(models.Hospital).filter_by(code="h-2").first()
    for hospital, count in ((near, 3), (far, 2)):
        dispatch.resize_fleet(db, hospital, count)
        dispatch.set_availability(db, hospital, count)
    db.commit()
    return near, far


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
        self.near, self.far = seed(self.db)

    def test_resize_creates_and_removes_ambulances(self):
        dispatch.resize_fleet(self.db, self.near, 5)
        self.db.commit()
        self.assertEqual(len(self.near.ambulances), 5)
        dispatch.resize_fleet(self.db, self.near, 2)
        self.db.commit()
        self.assertEqual(len(self.near.ambulances), 2)

    def test_cannot_shrink_below_busy_ambulances(self):
        incident = models.Incident(alert_id="a-1", trip_id="t", severity=6, lat=30.04, lon=31.24,
                                   hospital_id=self.near.id)
        self.db.add(incident)
        self.db.commit()
        busy = self.near.ambulances[0]
        busy.incident_id = incident.id
        self.db.commit()
        with self.assertRaises(dispatch.CapacityError):
            dispatch.resize_fleet(self.db, self.near, 0)

    def test_availability_recomputes_from_status(self):
        dispatch.set_availability(self.db, self.near, 1)
        self.db.commit()
        self.assertEqual(self.near.ambulances_available, 1)
        with self.assertRaises(dispatch.CapacityError):
            dispatch.set_availability(self.db, self.near, 99)

    def test_occupied_beds_track_active_cases(self):
        self.assertEqual(self.near.beds_occupied, 0)
        incident = models.Incident(alert_id="a-2", trip_id="t", severity=6, lat=30.04, lon=31.24,
                                   hospital_id=self.near.id, status="on_scene")
        self.db.add(incident)
        self.db.commit()
        dispatch.sync_beds(self.db, self.near)
        self.assertEqual(self.near.beds_occupied, 1)
        self.assertEqual(self.near.free_beds, 3)

    def test_cannot_set_beds_below_active_cases(self):
        incident = models.Incident(alert_id="a-3", trip_id="t", severity=6, lat=30.04, lon=31.24,
                                   hospital_id=self.near.id, status="on_scene")
        self.db.add(incident)
        self.db.commit()
        with self.assertRaises(dispatch.CapacityError):
            dispatch.set_beds(self.db, self.near, 0)

    def test_eta_scales_with_distance(self):
        near = geo.eta_seconds(geo.haversine_m(30.040, 31.240, 30.041, 31.241))
        far = geo.eta_seconds(geo.haversine_m(30.030, 31.230, 30.050, 31.250))
        self.assertLess(near, far)


if __name__ == "__main__":
    unittest.main()

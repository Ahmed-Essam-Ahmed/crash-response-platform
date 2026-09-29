import json
import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.domain import geo
from app.services import progression, routing

ROAD = [
    {"lat": 30.0000, "lon": 31.0000},
    {"lat": 30.0000, "lon": 31.0040},
    {"lat": 30.0030, "lon": 31.0040},
    {"lat": 30.0030, "lon": 31.0080},
]

HOSPITAL_LAT, HOSPITAL_LON = 30.0000, 31.0000
CRASH_LAT, CRASH_LON = 30.0030, 31.0080


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def build(db, status, elapsed_seconds, route=ROAD):
    hospital = models.Hospital(
        code="h-route", name="Route Hospital", lat=HOSPITAL_LAT, lon=HOSPITAL_LON,
        trauma_level=3, beds_total=6, ambulances_total=1, ambulances_available=1,
    )
    db.add(hospital)
    db.commit()

    incident = models.Incident(
        alert_id="alert-route", trip_id="trip-route", severity=7.0,
        lat=CRASH_LAT, lon=CRASH_LON, status=status, hospital_id=hospital.id,
        eta_scene_seconds=120, eta_hospital_seconds=120,
    )
    if route:
        incident.route_outbound = json.dumps(route)
        incident.route_inbound = json.dumps(route)
    db.add(incident)
    db.commit()
    db.refresh(incident)

    ambulance = models.Ambulance(
        code="amb-route", hospital_id=hospital.id, incident_id=incident.id,
        lat=HOSPITAL_LAT, lon=HOSPITAL_LON, status="assigned",
    )
    db.add(ambulance)
    db.commit()
    db.refresh(incident)

    incident.events.append(
        models.IncidentEvent(
            status=status, note="test",
            created_at=datetime.utcnow() - timedelta(seconds=elapsed_seconds),
        )
    )
    db.commit()
    db.refresh(incident)
    return incident


class AmbulanceFollowsTheRoadTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()

    def tearDown(self):
        self.db.close()

    def test_the_ambulance_is_on_the_road_at_the_midpoint(self):
        incident = build(self.db, "en_route_to_scene", 60)
        progression._move_ambulances(incident)
        ambulance = incident.ambulances[0]

        on_road = min(
            geo.haversine_m(point["lat"], point["lon"], ambulance.lat, ambulance.lon)
            for point in ROAD
        )
        straight_mid = geo.interpolate(HOSPITAL_LAT, HOSPITAL_LON, CRASH_LAT, CRASH_LON, 0.5)
        from_straight = geo.haversine_m(
            straight_mid["lat"], straight_mid["lon"], ambulance.lat, ambulance.lon
        )
        self.assertLess(on_road, 40.0)
        self.assertGreater(from_straight, 100.0)

    def test_the_return_leg_uses_the_stored_path(self):
        incident = build(self.db, "en_route_to_hospital", 60)
        progression._move_ambulances(incident)
        ambulance = incident.ambulances[0]
        self.assertEqual(ambulance.status, "transporting")
        on_road = min(
            geo.haversine_m(point["lat"], point["lon"], ambulance.lat, ambulance.lon)
            for point in ROAD
        )
        self.assertLess(on_road, 40.0)

    def test_a_case_with_no_stored_route_still_moves(self):
        incident = build(self.db, "en_route_to_scene", 60, route=None)
        progression._move_ambulances(incident)
        ambulance = incident.ambulances[0]
        self.assertEqual(ambulance.status, "en_route")
        self.assertGreater(ambulance.lon, HOSPITAL_LON)

    def test_corrupt_stored_route_falls_back_instead_of_stopping(self):
        incident = build(self.db, "en_route_to_scene", 60)
        incident.route_outbound = "{not json"
        self.db.add(incident)
        self.db.commit()
        self.db.refresh(incident)
        progression._move_ambulances(incident)
        ambulance = incident.ambulances[0]
        self.assertEqual(ambulance.status, "en_route")
        self.assertGreater(ambulance.lon, HOSPITAL_LON)

    def test_a_single_point_route_is_ignored(self):
        incident = build(self.db, "en_route_to_scene", 60, route=[ROAD[0]])
        progression._move_ambulances(incident)
        self.assertEqual(incident.ambulances[0].status, "en_route")

    def test_on_scene_parks_the_ambulance_at_the_crash(self):
        incident = build(self.db, "on_scene", 30)
        progression._move_ambulances(incident)
        ambulance = incident.ambulances[0]
        self.assertEqual(ambulance.status, "on_scene")
        self.assertAlmostEqual(ambulance.lat, CRASH_LAT, places=6)


class RouteStorageTest(unittest.TestCase):
    def setUp(self):
        self.db = make_db()
        routing.clear_cache()

    def tearDown(self):
        self.db.close()
        routing.clear_cache()

    def test_both_legs_are_stored_when_a_case_is_accepted(self):
        import asyncio

        from app.services import intake

        hospital = models.Hospital(
            code="h-store", name="Store Hospital", lat=HOSPITAL_LAT, lon=HOSPITAL_LON,
            trauma_level=3, beds_total=6, ambulances_total=1, ambulances_available=1,
        )
        self.db.add(hospital)
        self.db.commit()

        incident = models.Incident(
            alert_id="alert-store", trip_id="trip-store", severity=6.0,
            lat=CRASH_LAT, lon=CRASH_LON, status="contacts_notified",
        )
        self.db.add(incident)
        self.db.commit()
        self.db.refresh(incident)

        original = routing.road_route
        routing.road_route = lambda *a, **k: list(ROAD)
        try:
            asyncio.run(intake.store_routes(self.db, incident, hospital))
        finally:
            routing.road_route = original

        self.assertTrue(incident.route_outbound)
        self.assertTrue(incident.route_inbound)
        self.assertEqual(len(json.loads(incident.route_outbound)), len(ROAD))

    def test_an_existing_route_is_not_fetched_again(self):
        import asyncio

        from app.services import intake

        hospital = models.Hospital(
            code="h-keep", name="Keep Hospital", lat=HOSPITAL_LAT, lon=HOSPITAL_LON,
            trauma_level=3, beds_total=6, ambulances_total=1, ambulances_available=1,
        )
        self.db.add(hospital)
        incident = models.Incident(
            alert_id="alert-keep", trip_id="trip-keep", severity=6.0,
            lat=CRASH_LAT, lon=CRASH_LON, status="contacts_notified",
            route_outbound=json.dumps(ROAD), route_inbound=json.dumps(ROAD),
        )
        self.db.add_all([hospital, incident])
        self.db.commit()
        self.db.refresh(incident)

        calls = []
        original = routing.road_route
        routing.road_route = lambda *a, **k: calls.append(a) or list(ROAD)
        try:
            asyncio.run(intake.store_routes(self.db, incident, hospital))
        finally:
            routing.road_route = original
        self.assertEqual(calls, [])

    def test_the_serialized_route_keeps_the_two_directions_apart(self):
        from app import serializers

        incident = models.Incident(
            alert_id="alert-ser", trip_id="t", severity=5.0, lat=CRASH_LAT, lon=CRASH_LON,
            status="detected",
            route_outbound=json.dumps(ROAD),
            route_inbound=json.dumps(list(reversed(ROAD))),
        )
        payload = serializers.incident_to_dict(incident, include_events=False)
        self.assertEqual(payload["route"]["outbound"][0], ROAD[0])
        self.assertEqual(payload["route"]["inbound"][0], ROAD[-1])

    def test_a_case_with_no_route_serialises_as_empty_lists(self):
        from app import serializers

        incident = models.Incident(
            alert_id="alert-none", trip_id="t", severity=5.0, lat=CRASH_LAT, lon=CRASH_LON,
            status="detected",
        )
        payload = serializers.incident_to_dict(incident, include_events=False)
        self.assertEqual(payload["route"], {"outbound": [], "inbound": []})


if __name__ == "__main__":
    unittest.main()

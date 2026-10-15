import unittest
import tempfile
import os
import json
from datetime import datetime, timedelta

# Simulate a tiny DB structure? No, easier to test pure functions
from analytics import aggregate
from filters import Filters


class TestAnalytics(unittest.TestCase):
    def setUp(self):
        now = datetime.utcnow()
        self.inc = [
            {
                "alert_id": "a1",
                "severity": 9.5,
                "lat": 30.0444,
                "lon": 31.2357,
                "created_at": now.isoformat(),
                "gender": "male",
                "age": 24,
                "destination": "trauma_centre",
                "status": "closed",
                "region": "Cairo",
                "age_group": "18-25",
                "hospital_id": 1,
                "hospital_code": "H1",
                "hospital_name": "H1",
                "events": [],
                "offers": [],
                "closed_at": (now + timedelta(seconds=600)).isoformat(),
                "accepted_at": (now + timedelta(seconds=30)).isoformat(),
                "eta_hospital_seconds": 300,
            },
            {
                "alert_id": "a2",
                "severity": 5.0,
                "lat": 30.0444,
                "lon": 31.2357,
                "created_at": now.isoformat(),
                "gender": "female",
                "age": 50,
                "destination": "major",
                "status": "en_route_to_hospital",
                "region": "Cairo",
                "age_group": "41-60",
                "hospital_id": 1,
                "hospital_code": "H1",
                "hospital_name": "H1",
                "events": [],
                "offers": [],
            },
        ]

    def test_aggregate_totals(self):
        f = Filters([], None, None, 0, 10, [], [], [], [], [])
        res = aggregate(self.inc, f)
        self.assertEqual(res["totals"]["incidents"], 2)
        self.assertGreaterEqual(res["totals"]["severe"], 1)


if __name__ == "__main__":
    unittest.main()

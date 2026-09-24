import unittest

from detection.pipeline import DetectionPipeline
from detection.rules import PEAK_G_THRESHOLD, delta_v, peak_g, rule_detection
from detection.severity import score_severity


def make_sample(t, g, speed):
    return {
        "t": t, "gps": {"lat": 30.0, "lon": 31.0, "speed_mps": speed},
        "accel": {"g": g, "x": -g, "y": 0.0, "z": 1.0},
    }


class TestRules(unittest.TestCase):
    def test_detects_spike(self):
        window = [make_sample(i * 0.1, g, 16.0 - 0.5 * i) for i, g in
                  enumerate([0.9, 0.9, 6.0, 7.0, 5.0, 0.9, 0.9, 0.9, 0.9, 0.9] + [0.9] * 30)]
        rule = rule_detection(window)
        self.assertTrue(rule["fired"])
        self.assertEqual(rule["impact_type"], "frontal")

    def test_ignores_normal_driving(self):
        window = [make_sample(i * 0.1, 0.9, 15.0) for i in range(40)]
        self.assertFalse(rule_detection(window)["fired"])


class TestSeverity(unittest.TestCase):
    def test_bounds(self):
        low, _ = score_severity({"peak_g": 0, "delta_v_mps": 0, "speed_at_impact_mps": 0,
                                 "impact_type_weight": 0.1, "post_crash_inactive": False})
        high, _ = score_severity({"peak_g": 12, "delta_v_mps": 20, "speed_at_impact_mps": 25,
                                  "impact_type_weight": 1.0, "post_crash_inactive": True})
        self.assertGreaterEqual(low, 0.0)
        self.assertLessEqual(high, 10.0)
        self.assertGreater(high, low)


class TestPipeline(unittest.TestCase):
    def test_process_scenario(self):
        scenario = {
            "trips": [
                {
                    "trip_id": "t1", "label": "crash",
                    "samples": [make_sample(i * 0.1, g, 16.0 - 0.5 * i) for i, g in
                                enumerate([0.9] * 100 + [6.5, 7.1, 5.2, 0.9, 0.0, 0.0] + [0.9] * 50)],
                },
                {
                    "trip_id": "t2", "label": "near_miss",
                    "samples": [make_sample(i * 0.1, 0.9, 15.0) for i in range(200)],
                },
            ]
        }
        res = DetectionPipeline().process_scenario(scenario)
        fired = [r for r in res if r["detection"]["rule"]]
        self.assertTrue(any(r["expected"] for r in fired))


if __name__ == "__main__":
    unittest.main()
import unittest

from simulator.crash import crash_signature, near_miss_brake
from simulator.scenario import build_demo_scenario


class TestCrashSignature(unittest.TestCase):
    def test_peak_g_within_range(self):
        samples, meta = crash_signature(16.0, 7.0)
        peak = max(s["g"] for s in samples)
        self.assertGreaterEqual(peak, meta["peak_g"] - 0.15)
        self.assertLessEqual(meta["peak_g"], 12.0)

    def test_aftermath_zero_speed(self):
        samples, _ = crash_signature(16.0, 7.0)
        self.assertEqual(samples[-1]["speed_mps"], 0.0)
        self.assertTrue(all(s["inactive_after_impact"] for s in samples[len(samples) // 2:]))


class TestNearMiss(unittest.TestCase):
    def test_does_not_exceed_crash_threshold(self):
        nm = near_miss_brake(20.0)
        self.assertLess(max(s["g"] for s in nm), 1.0)


class TestScenario(unittest.TestCase):
    def test_labels(self):
        scen = build_demo_scenario()
        labels = {t["trip_id"]: t["label"] for t in scen["trips"]}
        self.assertEqual(labels["trip-0001"], "crash")
        self.assertEqual(labels["trip-0002"], "near_miss")

    def test_crash_meta_present(self):
        scen = build_demo_scenario()
        crash_trip = next(t for t in scen["trips"] if t["label"] == "crash")
        self.assertIsNotNone(crash_trip["crash"]["impact_factors"])


if __name__ == "__main__":
    unittest.main()
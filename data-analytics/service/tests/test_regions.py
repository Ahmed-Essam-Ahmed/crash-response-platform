import unittest
from regions import region_for, haversine_m


class TestRegions(unittest.TestCase):
    def test_cairo(self):
        self.assertEqual(region_for(30.0444, 31.2357), "Cairo")

    def test_far_away_unknown(self):
        self.assertIsNone(region_for(0, 0))


if __name__ == "__main__":
    unittest.main()

import unittest
from datetime import datetime

from filters import parse_filters, passes


class TestFilters(unittest.TestCase):
    def test_scalar_query_params_are_unwrapped(self):
        f = parse_filters(
            {
                "governorate": ["Cairo", "Giza"],
                "severity_min": ["8"],
                "from": ["2026-10-01"],
                "to": ["2026-11-03"],
            }
        )
        self.assertEqual(f.regions, ["Cairo", "Giza"])
        self.assertEqual(f.severity_min, 8.0)
        self.assertEqual(f.date_from, datetime(2026, 10, 1))
        self.assertEqual(f.date_to, datetime(2026, 11, 3, 23, 59, 59, 999999))

    def test_region_alias_is_merged(self):
        f = parse_filters({"governorate": ["Cairo"], "region": ["Giza"]})
        self.assertEqual(f.regions, ["Cairo", "Giza"])

    def test_severity_and_end_of_day(self):
        f = parse_filters({"severity_min": "7", "to": "2026-11-03"})
        self.assertFalse(passes({"severity": 5.0, "region": "Cairo"}, f, "Cairo", None))
        self.assertTrue(
            passes(
                {"severity": 8.0, "created_at": "2026-11-03T18:30:00", "region": "Cairo"},
                f,
                "Cairo",
                None,
            )
        )


if __name__ == "__main__":
    unittest.main()

import unittest

from app.domain import geo


class PositionAlongTest(unittest.TestCase):
    def test_a_single_point_is_always_returned(self):
        self.assertEqual(geo.position_along([{"lat": 1.0, "lon": 2.0}], 0.5), {"lat": 1.0, "lon": 2.0})

    def test_an_empty_path_is_rejected(self):
        with self.assertRaises(ValueError):
            geo.position_along([], 0.5)

    def test_the_ends_are_exact(self):
        path = [{"lat": 30.0, "lon": 31.0}, {"lat": 30.01, "lon": 31.01}]
        self.assertEqual(geo.position_along(path, 0.0)["lat"], 30.0)
        self.assertEqual(geo.position_along(path, 1.0)["lat"], 30.01)

    def test_progress_is_clamped_to_the_path(self):
        path = [{"lat": 30.0, "lon": 31.0}, {"lat": 30.01, "lon": 31.0}]
        self.assertEqual(geo.position_along(path, -4.0)["lat"], 30.0)
        self.assertEqual(geo.position_along(path, 9.0)["lat"], 30.01)

    def test_the_midpoint_of_an_l_shape_is_measured_by_distance(self):
        path = [
            {"lat": 30.000, "lon": 31.000},
            {"lat": 30.010, "lon": 31.000},
            {"lat": 30.010, "lon": 31.010},
        ]
        first_leg = geo.haversine_m(30.000, 31.000, 30.010, 31.000)
        second_leg = geo.haversine_m(30.010, 31.000, 30.010, 31.010)
        self.assertGreater(first_leg, second_leg)

        middle = geo.position_along(path, 0.5)
        self.assertAlmostEqual(middle["lon"], 31.000, places=6)
        self.assertLess(middle["lat"], 30.010)
        self.assertGreater(middle["lat"], 30.000)

    def test_an_l_shape_with_equal_legs_reaches_the_corner_at_the_midpoint(self):
        north = geo.haversine_m(30.000, 31.000, 30.010, 31.000)
        east_span = 0.01 * north / geo.haversine_m(30.010, 31.000, 30.010, 31.010)
        path = [
            {"lat": 30.000, "lon": 31.000},
            {"lat": 30.010, "lon": 31.000},
            {"lat": 30.010, "lon": 31.000 + east_span},
        ]
        middle = geo.position_along(path, 0.5)
        self.assertAlmostEqual(middle["lat"], 30.010, places=5)
        self.assertAlmostEqual(middle["lon"], 31.000, places=5)

    def test_progress_is_measured_by_distance_not_by_point_count(self):
        long_leg = [{"lat": 30.0, "lon": 31.0}, {"lat": 30.0, "lon": 31.01}]
        many_short = [
            {"lat": 30.0, "lon": 31.0},
            {"lat": 30.0, "lon": 31.005},
            {"lat": 30.0, "lon": 31.01},
        ]
        a = geo.position_along(long_leg, 0.5)
        b = geo.position_along(many_short, 0.5)
        self.assertAlmostEqual(a["lon"], b["lon"], places=4)

    def test_duplicate_points_do_not_break_the_walk(self):
        path = [
            {"lat": 30.0, "lon": 31.0},
            {"lat": 30.0, "lon": 31.0},
            {"lat": 30.0, "lon": 31.01},
        ]
        middle = geo.position_along(path, 0.5)
        self.assertAlmostEqual(middle["lon"], 31.005, places=4)


class PolylineLengthTest(unittest.TestCase):
    def test_a_single_point_has_no_length(self):
        self.assertEqual(geo.polyline_length([{"lat": 1.0, "lon": 1.0}]), 0.0)

    def test_length_is_the_sum_of_its_legs(self):
        points = [
            {"lat": 30.0, "lon": 31.0},
            {"lat": 30.01, "lon": 31.0},
            {"lat": 30.01, "lon": 31.01},
        ]
        expected = geo.haversine_m(30.0, 31.0, 30.01, 31.0) + geo.haversine_m(30.01, 31.0, 30.01, 31.01)
        self.assertAlmostEqual(geo.polyline_length(points), expected, places=3)

    def test_a_dogleg_is_longer_than_the_straight_line(self):
        dogleg = [
            {"lat": 30.000, "lon": 31.000},
            {"lat": 30.010, "lon": 31.000},
            {"lat": 30.010, "lon": 31.010},
        ]
        direct = geo.haversine_m(30.0, 31.0, 30.01, 31.01)
        self.assertGreater(geo.polyline_length(dogleg), direct)


class SimplifyTest(unittest.TestCase):
    def test_short_paths_are_untouched(self):
        points = [{"lat": 1.0, "lon": 1.0}, {"lat": 1.1, "lon": 1.1}]
        self.assertEqual(geo.simplify(points), points)

    def test_the_endpoints_are_always_kept(self):
        points = [
            {"lat": 30.0, "lon": 31.0},
            {"lat": 30.00001, "lon": 31.00001},
            {"lat": 30.02, "lon": 31.0},
        ]
        simplified = geo.simplify(points, tolerance_m=1.0)
        self.assertEqual(simplified[0], points[0])
        self.assertEqual(simplified[-1], points[-1])

    def test_nearly_identical_points_are_dropped(self):
        points = [
            {"lat": 30.0, "lon": 31.0},
            {"lat": 30.0000001, "lon": 31.0},
            {"lat": 30.0000002, "lon": 31.0},
            {"lat": 30.01, "lon": 31.0},
        ]
        self.assertEqual(len(geo.simplify(points, tolerance_m=5.0)), 2)

    def test_the_shape_survives_simplification(self):
        points = [
            {"lat": 30.000, "lon": 31.000},
            {"lat": 30.000, "lon": 31.005},
            {"lat": 30.005, "lon": 31.005},
            {"lat": 30.010, "lon": 31.005},
        ]
        simplified = geo.simplify(points, tolerance_m=1.0)
        self.assertEqual(len(simplified), 4)
        self.assertLess(abs(geo.polyline_length(simplified) - geo.polyline_length(points)), 5.0)


class RoutingFallbackTest(unittest.TestCase):
    def test_a_disabled_router_returns_the_straight_line(self):
        from app.services import routing

        routing.clear_cache()
        original = routing.ROAD_ROUTER_ENABLED
        try:
            routing.ROAD_ROUTER_ENABLED = False
            points = routing.road_route(30.0, 31.0, 30.01, 31.01)
        finally:
            routing.ROAD_ROUTER_ENABLED = original
            routing.clear_cache()
        self.assertEqual(points, [{"lat": 30.0, "lon": 31.0}, {"lat": 30.01, "lon": 31.01}])

    def test_a_failing_router_returns_the_straight_line(self):
        from app.services import routing

        routing.clear_cache()
        original = routing._fetch
        try:
            routing._fetch = lambda *a, **k: (_ for _ in ()).throw(OSError("router down"))
            points = routing.road_route(30.0, 31.0, 30.01, 31.01)
        finally:
            routing._fetch = original
            routing.clear_cache()
        self.assertEqual(len(points), 2)

    def test_a_single_point_geometry_is_not_treated_as_a_route(self):
        import io
        import json as jsonlib

        from app.services import routing

        body = jsonlib.dumps(
            {"code": "Ok", "routes": [{"geometry": {"coordinates": [[31.0, 30.0]]}}]}
        ).encode()

        class FakeResponse:
            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *a):
                return False

            def read(self_inner):
                return body

        original_urlopen = routing.urllib.request.urlopen
        routing.urllib.request.urlopen = lambda *a, **k: FakeResponse()
        try:
            self.assertIsNone(routing._fetch(30.0, 31.0, 30.01, 31.01))
        finally:
            routing.urllib.request.urlopen = original_urlopen

    def test_a_router_that_returns_nothing_falls_back(self):
        from app.services import routing

        routing.clear_cache()
        original = routing._fetch
        try:
            routing._fetch = lambda *a, **k: None
            points = routing.road_route(30.0, 31.0, 30.01, 31.01)
        finally:
            routing._fetch = original
            routing.clear_cache()
        self.assertEqual(len(points), 2)

    def test_an_incident_gets_both_directions(self):
        from app.services import routing

        routing.clear_cache()
        original = routing._fetch
        try:
            routing._fetch = lambda *a, **k: [{"lat": a[0], "lon": a[1]}, {"lat": a[2], "lon": a[3]}]
            both = routing.routes_for_incident(30.0, 31.0, 30.01, 31.01)
        finally:
            routing._fetch = original
            routing.clear_cache()
        self.assertEqual(sorted(both), ["inbound", "outbound"])
        self.assertEqual(both["outbound"][0], {"lat": 30.0, "lon": 31.0})
        self.assertEqual(both["inbound"][0], {"lat": 30.01, "lon": 31.01})


if __name__ == "__main__":
    unittest.main()

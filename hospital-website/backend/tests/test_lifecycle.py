import unittest

from app.domain import lifecycle
from app.domain.lifecycle import InvalidTransition, Status


class LifecycleTest(unittest.TestCase):
    def test_happy_path_is_legal(self):
        path = [
            Status.DETECTED,
            Status.CONTACTS_NOTIFIED,
            Status.AMBULANCE_ASSIGNED,
            Status.EN_ROUTE_TO_SCENE,
            Status.ON_SCENE,
            Status.EN_ROUTE_TO_HOSPITAL,
            Status.AT_HOSPITAL,
            Status.CLOSED,
        ]
        for current, nxt in zip(path, path[1:]):
            self.assertTrue(lifecycle.can_transition(current, nxt), f"{current} -> {nxt}")
            self.assertEqual(lifecycle.assert_transition(current, nxt), nxt)

    def test_cannot_skip_states(self):
        self.assertFalse(lifecycle.can_transition(Status.DETECTED, Status.ON_SCENE))
        self.assertFalse(lifecycle.can_transition(Status.DETECTED, Status.CLOSED))

    def test_closed_is_final(self):
        self.assertTrue(lifecycle.is_terminal(Status.CLOSED))
        self.assertFalse(lifecycle.can_transition(Status.CLOSED, Status.DETECTED))

    def test_cancel_allowed_until_arrival(self):
        self.assertTrue(lifecycle.can_transition(Status.DETECTED, Status.CANCELLED))
        self.assertTrue(lifecycle.can_transition(Status.EN_ROUTE_TO_SCENE, Status.CANCELLED))
        self.assertFalse(lifecycle.can_transition(Status.AT_HOSPITAL, Status.CANCELLED))

    def test_invalid_transition_raises(self):
        with self.assertRaises(InvalidTransition):
            lifecycle.assert_transition(Status.DETECTED, Status.CLOSED)

    def test_active_predicate(self):
        self.assertTrue(lifecycle.is_active(Status.EN_ROUTE_TO_SCENE))
        self.assertFalse(lifecycle.is_active(Status.CLOSED))
        self.assertFalse(lifecycle.is_active(Status.CANCELLED))

    def test_unknown_status_rejected(self):
        self.assertFalse(lifecycle.can_transition("not-a-status", Status.CLOSED))

    def test_default_next_walks_the_happy_path(self):
        path = [
            Status.DETECTED,
            Status.CONTACTS_NOTIFIED,
            Status.AMBULANCE_ASSIGNED,
            Status.EN_ROUTE_TO_SCENE,
            Status.ON_SCENE,
            Status.EN_ROUTE_TO_HOSPITAL,
            Status.AT_HOSPITAL,
            Status.CLOSED,
        ]
        for current, nxt in zip(path, path[1:]):
            self.assertEqual(lifecycle.default_next(current), nxt)
        self.assertIsNone(lifecycle.default_next(Status.CLOSED))
        self.assertIsNone(lifecycle.default_next(Status.CANCELLED))

    def test_default_next_never_suggests_cancelling(self):
        suggested = {lifecycle.default_next(s) for s in lifecycle.HAPPY_PATH}
        self.assertNotIn(Status.CANCELLED, suggested)

    def test_step_index_progresses_monotonically(self):
        indices = [lifecycle.step_index(s) for s in lifecycle.HAPPY_PATH]
        self.assertEqual(indices, sorted(indices))
        self.assertEqual(lifecycle.step_index(Status.DETECTED), 0)
        self.assertEqual(lifecycle.step_index(Status.CLOSED), len(lifecycle.HAPPY_PATH) - 1)


if __name__ == "__main__":
    unittest.main()

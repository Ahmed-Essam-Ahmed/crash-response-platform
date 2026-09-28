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


if __name__ == "__main__":
    unittest.main()

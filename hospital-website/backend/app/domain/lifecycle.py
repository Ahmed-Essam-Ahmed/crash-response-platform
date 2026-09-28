from enum import Enum


class Status(str, Enum):
    DETECTED = "detected"
    CONTACTS_NOTIFIED = "contacts_notified"
    AMBULANCE_ASSIGNED = "ambulance_assigned"
    EN_ROUTE_TO_SCENE = "en_route_to_scene"
    ON_SCENE = "on_scene"
    EN_ROUTE_TO_HOSPITAL = "en_route_to_hospital"
    AT_HOSPITAL = "at_hospital"
    CLOSED = "closed"
    CANCELLED = "cancelled"


TRANSITIONS = {
    Status.DETECTED: {Status.CONTACTS_NOTIFIED, Status.CANCELLED},
    Status.CONTACTS_NOTIFIED: {Status.AMBULANCE_ASSIGNED, Status.CANCELLED},
    Status.AMBULANCE_ASSIGNED: {Status.EN_ROUTE_TO_SCENE, Status.CANCELLED},
    Status.EN_ROUTE_TO_SCENE: {Status.ON_SCENE, Status.CANCELLED},
    Status.ON_SCENE: {Status.EN_ROUTE_TO_HOSPITAL, Status.CANCELLED},
    Status.EN_ROUTE_TO_HOSPITAL: {Status.AT_HOSPITAL, Status.CANCELLED},
    Status.AT_HOSPITAL: {Status.CLOSED},
    Status.CLOSED: set(),
    Status.CANCELLED: set(),
}

TERMINAL = {Status.CLOSED, Status.CANCELLED}

HAPPY_PATH = [
    Status.DETECTED,
    Status.CONTACTS_NOTIFIED,
    Status.AMBULANCE_ASSIGNED,
    Status.EN_ROUTE_TO_SCENE,
    Status.ON_SCENE,
    Status.EN_ROUTE_TO_HOSPITAL,
    Status.AT_HOSPITAL,
    Status.CLOSED,
]

ACTIVE_STATUSES = {
    Status.DETECTED,
    Status.CONTACTS_NOTIFIED,
    Status.AMBULANCE_ASSIGNED,
    Status.EN_ROUTE_TO_SCENE,
    Status.ON_SCENE,
    Status.EN_ROUTE_TO_HOSPITAL,
    Status.AT_HOSPITAL,
}


class InvalidTransition(Exception):
    def __init__(self, current, target):
        self.current = current
        self.target = target
        super().__init__(f"cannot move incident from '{current}' to '{target}'")


def can_transition(current, target) -> bool:
    try:
        current = Status(current)
        target = Status(target)
    except ValueError:
        return False
    return target in TRANSITIONS[current]


def assert_transition(current, target):
    if not can_transition(current, target):
        raise InvalidTransition(current, target)
    return Status(target)


def next_states(current):
    return {s.value for s in TRANSITIONS[Status(current)]}


def is_terminal(status) -> bool:
    return Status(status) in TERMINAL


def is_active(status) -> bool:
    return Status(status) in ACTIVE_STATUSES


def default_next(status):
    current = Status(status)
    if current not in HAPPY_PATH:
        return None
    index = HAPPY_PATH.index(current)
    return HAPPY_PATH[index + 1] if index + 1 < len(HAPPY_PATH) else None


def step_index(status) -> int:
    current = Status(status)
    return HAPPY_PATH.index(current) if current in HAPPY_PATH else 0

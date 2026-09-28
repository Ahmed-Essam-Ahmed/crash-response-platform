from enum import Enum


class Destination(str, Enum):
    TRAUMA_CENTRE = "trauma_centre"
    MAJOR = "major"
    MINOR = "minor"


TRAUMA_THRESHOLD = 8.0
MAJOR_THRESHOLD = 5.5


def destination_for(severity: float) -> Destination:
    if severity >= TRAUMA_THRESHOLD:
        return Destination.TRAUMA_CENTRE
    if severity >= MAJOR_THRESHOLD:
        return Destination.MAJOR
    return Destination.MINOR


def required_resources(severity: float) -> dict:
    destination = destination_for(severity)
    if destination is Destination.TRAUMA_CENTRE:
        return {"ambulances": 2, "trauma_bay": True, "escort": True, "priority": "immediate"}
    if destination is Destination.MAJOR:
        return {"ambulances": 1, "trauma_bay": False, "escort": True, "priority": "urgent"}
    return {"ambulances": 1, "trauma_bay": False, "escort": False, "priority": "routine"}


def accepts(hospital_trauma_level: int, destination: Destination) -> bool:
    if destination is Destination.TRAUMA_CENTRE:
        return hospital_trauma_level >= 3
    return True

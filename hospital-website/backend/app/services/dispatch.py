"""Fleet and bed capacity, kept in step with the ambulance records.

`ambulances_total` is how many ambulances the hospital owns. `ambulances_available`
is how many of those are usable right now, which is what changes when one is
bought, written off, or sent for servicing. Occupied beds are derived from the
active cases a hospital is holding, so the two can never disagree.
"""

import uuid

from .. import models


class CapacityError(Exception):
    pass


def active_cases(hospital: models.Hospital) -> list:
    from ..domain import lifecycle

    return [i for i in hospital.incidents if lifecycle.is_active(i.status)]


def sync_availability(db, hospital: models.Hospital) -> None:
    hospital.ambulances_available = len([a for a in hospital.ambulances if a.is_available])


def sync_beds(db, hospital: models.Hospital) -> None:
    in_use = len(active_cases(hospital))
    hospital.beds_occupied = min(in_use, hospital.beds_total) if hospital.beds_total else in_use
    hospital.current_load = in_use


def resize_fleet(db, hospital: models.Hospital, total: int | None = None) -> list:
    if total is None:
        return []

    total = max(0, int(total))
    fleet = sorted(hospital.ambulances, key=lambda a: a.id)
    busy = [a for a in fleet if a.incident_id is not None]
    idle = [a for a in fleet if a.incident_id is None]

    if total < len(busy):
        raise CapacityError(
            f"cannot go below {len(busy)}: {len(busy)} ambulance(s) are out on a case right now"
        )

    created = []
    while len(fleet) < total:
        index = len(fleet) + 1
        amb = models.Ambulance(
            code=f"{hospital.code}-amb-{suffix(hospital.code, index)}",
            label=f"Unit {index}",
            lat=hospital.lat,
            lon=hospital.lon,
            status="available",
            hospital=hospital,
        )
        db.add(amb)
        fleet.append(amb)
        created.append(amb)

    surplus = len(fleet) - total
    if surplus > 0:
        for amb in idle[-surplus:]:
            db.delete(amb)
            fleet.remove(amb)

    db.flush()
    sync_availability(db, hospital)
    return created


def set_availability(db, hospital: models.Hospital, available: int) -> None:
    fleet = sorted(hospital.ambulances, key=lambda a: a.id)
    free = [a for a in fleet if a.incident_id is None]

    available = max(0, int(available))
    if available > len(free):
        raise CapacityError(
            f"only {len(free)} of your {len(fleet)} ambulances are free, so at most "
            f"{len(free)} can be marked available"
        )

    for index, amb in enumerate(free):
        amb.status = "available" if index < available else "out_of_service"
    db.flush()
    sync_availability(db, hospital)


def set_beds(db, hospital: models.Hospital, total: int | None = None) -> None:
    if total is None:
        return

    total = max(0, int(total))
    in_use = len(active_cases(hospital))
    if total < in_use:
        raise CapacityError(
            f"cannot go below {in_use}: that many beds are taken by active cases"
        )
    hospital.beds_total = total
    db.flush()
    sync_beds(db, hospital)


def suffix(hospital_code: str, index: int) -> str:
    return f"{hospital_code.split('-')[-1]}{index}-{uuid.uuid4().hex[:4]}"

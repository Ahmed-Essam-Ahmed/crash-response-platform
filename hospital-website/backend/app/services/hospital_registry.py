"""Hospital registry: the curated list, and the duplicate guard around it.

Free text must never create a tenant. It creates a claim, a human reviews
it, and only then does a registry entry exist. That is what makes duplicate
hospitals impossible rather than merely discouraged.

Two signals catch a duplicate, and they are used together because neither is
sufficient on its own:

- a normalised name plus governorate match, which catches the same hospital
  typed twice
- a location within a few hundred metres of an existing entry, which
  catches the same building claimed under a different name
"""

from .. import models
from ..domain.geo import haversine_m
from ..domain.naming import normalize

# Close enough to be the same car park. Large enough that two genuinely
# separate facilities, even on one campus, are not collapsed.
DUPLICATE_RADIUS_M = 200.0

# Below this length a term matches too much to be informative. "ai" appears
# inside a dozen hospital names, so requiring three characters keeps a
# search from returning the entire list and hiding the intended match.
MIN_TERM_LENGTH = 3

# The 27 governorates, for the dropdown on the not-listed form.
GOVERNORATES = (
    "Cairo",
    "Giza",
    "Alexandria",
    "Beheira",
    "Dakahlia",
    "Damietta",
    "Fayoum",
    "Gharbia",
    "Ismailia",
    "Kafr El Sheikh",
    "Luxor",
    "Matrouh",
    "Minya",
    "Monufia",
    "New Valley",
    "North Sinai",
    "Port Said",
    "Qalyubia",
    "Qena",
    "Red Sea",
    "Sharqia",
    "Sohag",
    "South Sinai",
    "Suez",
    "Aswan",
    "Asyut",
    "Beni Suef",
)


def _alias_terms(row) -> list[str]:
    if not row.aliases:
        return []
    return [normalize(part) for part in row.aliases.split("|") if normalize(part)]


def _search_strings(row) -> list[str]:
    strings = [row.name_normalized]
    if row.name_ar:
        strings.append(normalize(row.name_ar))
    strings.extend(_alias_terms(row))
    return strings


def seed_registry(db, rows) -> int:
    """Insert registry entries that are not present yet. Never overwrites.

    Coordinates and aliases are filled in on an existing row when the row
    does not have them yet, so a later seed revision can correct a name
    without touching a coordinate that is now routing ambulances.
    """
    added = 0
    for name, name_ar, governorate, aliases in rows:
        normalized = normalize(name)
        existing = (
            db.query(models.RegistryHospital)
            .filter(
                models.RegistryHospital.name_normalized == normalized,
                models.RegistryHospital.governorate == governorate,
            )
            .first()
        )
        if existing is not None:
            if aliases and not existing.aliases:
                existing.aliases = aliases
            continue
        db.add(
            models.RegistryHospital(
                name=name,
                name_normalized=normalized,
                name_ar=name_ar,
                aliases=aliases,
                governorate=governorate,
                source="seed",
            )
        )
        added += 1
    if added:
        db.commit()
    return added


def search(db, query: str = "", governorate: str | None = None, limit: int = 20, include_demo: bool = False) -> list:
    rows = (
        db.query(models.RegistryHospital)
        .filter(models.RegistryHospital.is_active.is_(True))
        .order_by(models.RegistryHospital.name)
        .all()
    )

    # The demo tenants are fictional, so they stay out of the list a real
    # hospital is shown unless a developer explicitly asks for them.
    if not include_demo:
        rows = [r for r in rows if r.source != "demo"]

    if governorate:
        wanted = governorate.strip()
        rows = [r for r in rows if r.governorate == wanted]

    needle = normalize(query)
    if needle:
        terms = [t for t in needle.split() if len(t) >= MIN_TERM_LENGTH]
        if not terms:
            return []

        scored = []
        for row in rows:
            best = None
            for haystack in _search_strings(row):
                words = haystack.split()
                if haystack == needle:
                    score = 0
                elif haystack.startswith(needle):
                    score = 1
                elif all(_term_present(term, words) for term in terms):
                    score = 2
                elif len(terms) == 1 and any(w.startswith(terms[0]) for w in words):
                    # A partial match is only trusted for a single long
                    # enough term. With several terms, a looser rule keys off
                    # the weakest one, so "qasr al aini" would match every
                    # name containing "ai" and bury the real answer.
                    score = 3
                else:
                    continue
                best = score if best is None else min(best, score)
            if best is not None:
                scored.append((best, row.name, row))
        scored.sort(key=lambda item: (item[0], item[1]))
        rows = [row for _, _, row in scored]

    return rows[:limit]


def _term_present(term: str, words: list[str]) -> bool:
    """True when a term matches a word, tolerating a clipped final word.

    Compared in both directions because a person typing an alias often
    shortens it: "qasr al ainy" is the same hospital as "qasr al aini".
    """
    for word in words:
        if word == term or word.startswith(term) or term.startswith(word):
            return True
    return False


def same_name_elsewhere(db, name: str, governorate: str, exclude_id: int | None = None) -> list:
    normalized = normalize(name)
    rows = (
        db.query(models.RegistryHospital)
        .filter(models.RegistryHospital.name_normalized == normalized)
        .all()
    )
    return [r for r in rows if r.id != exclude_id and r.governorate != governorate]


def tenant_for(db, registry_id: int) -> models.Hospital | None:
    return (
        db.query(models.Hospital)
        .filter(models.Hospital.registry_id == registry_id)
        .first()
    )


def nearby(db, lat: float, lon: float, radius_m: float = DUPLICATE_RADIUS_M) -> list:
    """Registry entries that sit on top of the given point."""
    found = []
    for row in db.query(models.RegistryHospital).filter(models.RegistryHospital.is_active.is_(True)).all():
        if row.lat is None or row.lon is None:
            continue
        if haversine_m(lat, lon, row.lat, row.lon) <= radius_m:
            found.append(row)
    return found

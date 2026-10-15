"""Fill in registry coordinates by geocoding, then keep them for review.

Run once after the seed, or again when new hospitals are added:

    /Users/ahmed_essam/venv/bin/python scripts/geocode_registry.py
    /Users/ahmed_essam/venv/bin/python scripts/geocode_registry.py --dry-run

Coordinates are not guessed anywhere in this codebase. A hand typed point
does not fail loudly, it quietly sends ambulances to the wrong building, so
this only writes what a geocoder returned and leaves everything it cannot
resolve untouched for a human to confirm.

Nominatim's usage policy asks for at most one request a second, so the
delay is deliberate rather than a performance bug.
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import migrations, models  # noqa: E402
from app.config import NOMINATIM_TIMEOUT, NOMINATIM_URL  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.domain.naming import normalize  # noqa: E402
from app.services import hospital_registry  # noqa: E402
from app.services.hospital_seed import SEED_REGISTRY  # noqa: E402

USER_AGENT = "crash-response-platform/3.0 (hospital registry geocoding)"
REQUEST_DELAY_SECONDS = 1.1

# Nominatim classifies places, and a hospital search can pick up a
# neighbourhood, a hotel, or a road with a similar name. Only accept a hit
# that is actually a facility, so a bad match does not get persisted.
ACCEPTED_KINDS = (
    "hospital",
    "clinic",
    "healthcare",
    "health_care",
    "doctors",
    "nursing_home",
)


def geocode(query):
    url = f"{NOMINATIM_URL}?" + urllib.parse.urlencode(
        {"q": query, "format": "jsonv2", "limit": 5, "addressdetails": 1, "extratags": 1}
    )
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=NOMINATIM_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8")) or []


def _queries(row):
    variants = [
        f"{row.name}, {row.governorate}, Egypt",
        row.name,
        f"{row.name} {row.governorate}",
    ]
    if row.name_ar:
        variants.append(f"{row.name_ar}, {row.governorate}")
    for term in (row.aliases or "").split("|"):
        if term.strip():
            variants.append(f"{term.strip()}, {row.governorate}")
    return variants


def pick(rows, entry):
    """Choose a candidate only if it looks like the hospital we asked for.

    Nominatim tags a place `type=hospital` when it is some hospital, not when
    it is this one. Accepting that on its own put "Al-Hussein University
    Hospital" on a hospital in Minya and "Egyptian German Hospital" on the
    Saudi German Hospital in Cairo, which is worse than having no coordinate
    at all because nothing about it looks wrong downstream. So a candidate has
    to be in the right governorate and share a distinctive word with the name
    before it is accepted.
    """
    for row in rows:
        kind = (row.get("type") or row.get("class") or "").lower()
        if kind not in ACCEPTED_KINDS:
            continue
        lat, lon = row.get("lat"), row.get("lon")
        if lat is None or lon is None:
            continue
        if not _in_governorate(row, entry):
            continue
        if not _name_overlaps(row, entry):
            continue
        return row
    return None


def _in_governorate(candidate, entry) -> bool:
    """Check the result is in the right governorate.

    Nominatim returns the state in Arabic for most Egyptian places, so both
    spellings are checked. Without the Arabic form every Cairo hospital
    failed this test and the whole registry stayed empty.
    """
    # Only the structured fields count. Searching the free text display name
    # is how a hospital in Minya got accepted for a Cairo entry, because the
    # address contained "طريق القاهرة", which is Cairo Road.
    address = candidate.get("address") or {}
    fields = " ".join(
        str(address.get(key) or "") for key in ("state", "county", "city", "state_district")
    ).lower()
    if not fields:
        return False

    english = entry.governorate.lower()
    if english in fields or _city_alias(entry.governorate) in fields:
        return True

    arabic = _governorate_ar.get(entry.governorate)
    return bool(arabic) and arabic in fields


# Names Nominatim returns in its `state` field, which for Egypt is Arabic.
_governorate_ar = {
    "Cairo": "القاهرة",
    "Giza": "الجيزة",
    "Alexandria": "الإسكندرية",
    "Beheira": "البحيرة",
    "Dakahlia": "الدقهلية",
    "Fayoum": "الفيوم",
    "Gharbia": "الغربية",
    "Ismailia": "الإسماعيلية",
    "Luxor": "الأقصر",
    "Matrouh": "مطروح",
    "Minya": "المنيا",
    "Qalyubia": "القليوبية",
    "Qena": "قنا",
    "Red Sea": "البحر الأحمر",
    "Sharqia": "الشرقية",
    "Sohag": "سوهاج",
    "Suez": "السويس",
    "Aswan": "أسوان",
    "Asyut": "أسيوط",
    "Beni Suef": "بني سويف",
    "Port Said": "بورسعيد",
    "North Sinai": "شمال سيناء",
    "South Sinai": "جنوب سيناء",
    "New Valley": "الوادي الجديد",
}


def _name_overlaps(candidate, entry) -> bool:
    """Require a word that actually identifies this hospital.

    "Hospital" and "university" are shared by nearly every entry, so they do
    not count. One distinctive shared word is enough, which is why the aliases
    matter: they carry the words people actually search by.
    """
    # Compared against the place's own name, not the display name. The
    # display string is the street address, which carries unrelated words
    # from other places and let a wrong hospital through.
    label = normalize(candidate.get("name") or candidate.get("display_name") or "")
    return any(term in label for term in _search_terms(entry))


def _search_terms(entry) -> set[str]:
    common = {
        "hospital", "university", "general", "specialized", "children", "centre", "center",
        "teaching", "medical", "health", "institute", "clinic", "intensive", "care",
        "مستشفي", "مستشفى", "جامعه", "جامعة", "عام", "تخصصي", "اطفال", "الاطفال",
        "مركز", "ال مركز", "معهد", "مrst", "ال",
    }
    names = [entry.name, entry.name_ar or "", *(entry.aliases or "").split("|")]
    terms = set()
    for name in names:
        for word in normalize(name).split():
            if word not in common and len(word) >= 4:
                terms.add(word)
    return terms


def _city_alias(governorate) -> str:
    return {
        "Cairo": "cairo",
        "Giza": "giza",
        "Alexandria": "alexandria",
        "Beheira": "beheira",
        "Dakahlia": "dakahlia",
        "Fayoum": "fayoum",
        "Gharbia": "gharbia",
        "Ismailia": "ismailia",
        "Luxor": "luxor",
        "Matrouh": "matrouh",
        "Minya": "minya",
        "Qalyubia": "qalyubia",
        "Qena": "qena",
        "Red Sea": "red sea",
        "Sharqia": "sharqia",
        "Sohag": "sohag",
        "Suez": "suez",
        "Aswan": "aswan",
        "Asyut": "asyut",
        "Beni Suef": "beni suef",
        "Port Said": "port said",
        "North Sinai": "north sinai",
        "South Sinai": "south sinai",
        "New Valley": "new valley",
    }.get(governorate, governorate.lower())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    parser.add_argument("--regeocode", action="store_true", help="overwrite existing coordinates")
    parser.add_argument("--limit", type=int, default=0, help="stop after N requests")
    args = parser.parse_args()

    migrations.apply(engine)
    db = SessionLocal()
    try:
        hospital_registry.seed_registry(db, SEED_REGISTRY)

        pending = [
            row
            for row in db.query(models.RegistryHospital).all()
            if args.regeocode or not row.has_location
        ]
        if not pending:
            print("every entry already has coordinates")
            return 0

        resolved = unresolved = failed = 0
        for index, row in enumerate(pending, start=1):
            if args.limit and index > args.limit:
                print(f"stopping after {args.limit} requests as asked")
                break

            match = None
            # Nominatim's coverage of Egyptian hospitals is patchy and the
            # wording matters, so a few phrasings are tried before giving up.
            for attempt in _queries(row):
                try:
                    candidates = geocode(attempt)
                except Exception as exc:  # noqa: BLE001 - report and keep going
                    print(f"[{index}/{len(pending)}] {row.name}: {attempt!r} failed ({exc})")
                    failed += 1
                    candidates = []
                match = pick(candidates, row)
                if match is not None:
                    break
                time.sleep(REQUEST_DELAY_SECONDS)

            if match is None:
                print(f"[{index}/{len(pending)}] {row.name}: no confident match, left for review")
                unresolved += 1
            else:
                lat, lon = float(match["lat"]), float(match["lon"])
                print(
                    f"[{index}/{len(pending)}] {row.name}: {lat:.5f}, {lon:.5f} "
                    f"({match.get('display_name', '')[:70]})"
                )
                if not args.dry_run:
                    row.lat, row.lon = lat, lon
                    row.address = row.address or match.get("display_name")
                resolved += 1

            if not args.dry_run:
                db.commit()

        print(
            f"\nresolved {resolved}, left for review {unresolved}, failed {failed}"
            + (" (dry run, nothing written)" if args.dry_run else "")
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

"""Rebuild the starter registry from real public sources.

The registry that ships with the app (``app/services/hospital_seed.py``) is
not hand written. It is generated from two sources that carry verified
coordinates, so every hospital on the national map is a real hospital in a
real place:

- OpenStreetMap, via the Overpass API, for anything tagged
  ``amenity=hospital`` inside Egypt. (c) OpenStreetMap contributors, ODbL.
- Wikidata, for items that are hospitals in Egypt with a P625 point.
  Wikidata is CC0.

Run it to refresh the list after the sources change:

    /Users/ahmed_essam/venv/bin/python scripts/build_registry.py
    /Users/ahmed_essam/venv/bin/python scripts/build_registry.py --dry-run

Nothing is invented. If a source stops returning a hospital, the seed simply
stops containing it; the builder never fabricates a coordinate to fill a gap.
"""

import argparse
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain.naming import normalize  # noqa: E402

_POLYGONS: list = []

USER_AGENT = "crash-response-platform/3.0 (hospital registry build)"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
WIKIDATA_URL = "https://query.wikidata.org/sparql"
SEED_PATH = Path(__file__).resolve().parents[1] / "app" / "services" / "hospital_seed.py"

# The governorate a point falls in is answered by the real administrative
# boundary from OpenStreetMap, not by guessing the nearest capital. Centres
# are only a fallback for a point that lands a hair outside a simplified
# boundary.
GOVERNORATE_CENTRES = {
    "Cairo": (30.0444, 31.2357),
    "Giza": (30.0131, 31.2089),
    "Alexandria": (31.2001, 29.9187),
    "Beheira": (31.0341, 30.4682),
    "Dakahlia": (31.0409, 31.3785),
    "Damietta": (31.4165, 31.8133),
    "Fayoum": (29.3084, 30.8428),
    "Gharbia": (30.7865, 31.0004),
    "Ismailia": (30.5965, 32.2715),
    "Kafr El Sheikh": (31.1107, 30.9388),
    "Luxor": (25.6872, 32.6396),
    "Matrouh": (31.3543, 27.2373),
    "Minya": (28.1099, 30.7503),
    "Monufia": (30.5528, 31.0098),
    "New Valley": (25.4417, 30.5458),
    "North Sinai": (31.1267, 33.7989),
    "Port Said": (31.2653, 32.3019),
    "Qalyubia": (30.4647, 31.1848),
    "Qena": (26.1551, 32.7160),
    "Red Sea": (27.2579, 33.8116),
    "Sharqia": (30.5877, 31.5020),
    "Sohag": (26.5591, 31.6951),
    "South Sinai": (28.2407, 33.6221),
    "Suez": (29.9668, 32.5498),
    "Aswan": (24.0889, 32.8998),
    "Asyut": (27.1810, 31.1837),
    "Beni Suef": (29.0661, 31.0994),
}

# How OpenStreetMap spells each governorate in its name:en tag.
GOVERNORATE_OSM = {
    "North Sinai": "North Sinai", "South Sinai": "South Sinai", "Aswan": "Aswan",
    "Red Sea": "Red Sea", "Matruh": "Matrouh", "New Valley": "New Valley",
    "Alexandria": "Alexandria", "Al Ismailiya": "Ismailia", "Suez": "Suez",
    "Gharbiyya Governorate": "Gharbia", "Faiyum": "Fayoum", "Bani Sweif": "Beni Suef",
    "Al Minya": "Minya", "Asyut": "Asyut", "Suhaj": "Sohag", "Qena": "Qena",
    "Luxor": "Luxor", "Aj Jiza": "Giza", "Monufia Governorate": "Monufia",
    "Lake": "Beheira", "Cairo": "Cairo", "Al Qalyubiya": "Qalyubia",
    "Dakahlia Governorate": "Dakahlia", "Damietta": "Damietta",
    "Kafr El Sheikh": "Kafr El Sheikh", "Port Said": "Port Said",
    "Al Sharqia Governorate": "Sharqia",
}

GOVERNORATE_AR = {
    "القاهرة": "Cairo", "الجيزة": "Giza", "الإسكندرية": "Alexandria",
    "البحيرة": "Beheira", "الدقهلية": "Dakahlia", "دمياط": "Damietta",
    "الفيوم": "Fayoum", "الغربية": "Gharbia", "الإسماعيلية": "Ismailia",
    "كفر الشيخ": "Kafr El Sheikh", "الأقصر": "Luxor", "مطروح": "Matrouh",
    "المنيا": "Minya", "المنوفية": "Monufia", "الوادي الجديد": "New Valley",
    "شمال سيناء": "North Sinai", "بورسعيد": "Port Said", "القليوبية": "Qalyubia",
    "قنا": "Qena", "البحر الأحمر": "Red Sea", "الشرقية": "Sharqia",
    "سوهاج": "Sohag", "جنوب سيناء": "South Sinai", "السويس": "Suez",
    "أسوان": "Aswan", "أسيوط": "Asyut", "بني سويف": "Beni Suef",
}

OVERFLOW_QUERY = """
[out:json][timeout:180];
area["ISO3166-1"="EG"][admin_level=2]->.eg;
(
  node["amenity"="hospital"](area.eg);
  way["amenity"="hospital"](area.eg);
  relation["amenity"="hospital"](area.eg);
);
out center tags;
"""

GOVERNORATE_BOUNDARY_QUERY = """
[out:json][timeout:300];
area["ISO3166-1"="EG"][admin_level=2]->.eg;
rel["boundary"="administrative"]["admin_level"="4"](area.eg);
out geom;
"""

WIKIDATA_QUERY = """
SELECT ?item ?coord ?en ?ar WHERE {
  ?item wdt:P31/wdt:P279* wd:Q16917 .
  ?item wdt:P17 wd:Q79 .
  OPTIONAL { ?item wdt:P625 ?coord. }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en)="en") }
  OPTIONAL { ?item rdfs:label ?ar . FILTER(LANG(?ar)="ar") }
}
"""


def _post(url, data, accept):
    request = urllib.request.Request(
        url, data=urllib.parse.urlencode(data).encode(),
        headers={"User-Agent": USER_AGENT, "Accept": accept},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_osm():
    payload = _post(OVERPASS_URL, {"data": OVERFLOW_QUERY}, "application/json")
    out = []
    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lon = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        name = tags.get("name")
        name_en = tags.get("name:en")
        name_ar = tags.get("name:ar")
        if name and name[0].isascii():
            name_en = name_en or name
        elif name:
            name_ar = name_ar or name
        if not (name_en or name_ar):
            continue
        out.append({
            "en": name_en, "ar": name_ar, "lat": float(lat), "lon": float(lon),
            "src": "osm", "ref": f"{element.get('type')}/{element.get('id')}",
            "state": tags.get("addr:state") or tags.get("addr:governorate"),
        })
    return out


def fetch_wikidata():
    rows = _post(WIKIDATA_URL, {"query": WIKIDATA_QUERY, "format": "json"},
                 "application/sparql-results+json")
    out = []
    for binding in rows["results"]["bindings"]:
        coord = binding.get("coord", {}).get("value")
        if not coord or not coord.startswith("Point("):
            continue
        lon, lat = (float(x) for x in coord[6:-1].split())
        label = binding.get("itemLabel", {}).get("value")
        en = binding.get("en", {}).get("value") or (
            label if label and label[0].isascii() and not label.startswith("Q") else None
        )
        ar = binding.get("ar", {}).get("value")
        if not (en or ar):
            continue
        out.append({"en": en, "ar": ar, "lat": lat, "lon": lon, "src": "wd",
                    "ref": binding["item"]["value"].rsplit("/", 1)[-1]})
    return out


def haversine_m(lat1, lon1, lat2, lon2):
    radius = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(a)))


def in_egypt(lat, lon):
    return 22.0 <= lat <= 31.7 and 24.7 <= lon <= 36.9


def fetch_boundaries():
    payload = _post(OVERPASS_URL, {"data": GOVERNORATE_BOUNDARY_QUERY}, "application/json")
    polygons = []
    for element in payload.get("elements", []):
        name = GOVERNORATE_OSM.get(element.get("tags", {}).get("name:en"))
        if name is None:
            continue
        polygons.append((
            name,
            _stitch(_member_ways(element, "outer")),
            _stitch(_member_ways(element, "inner")),
        ))
    return polygons


def _member_ways(element, role):
    ways = []
    for member in element.get("members", []):
        if member.get("type") != "way":
            continue
        member_role = member.get("role") or "outer"
        if member_role == role:
            ways.append([(p["lat"], p["lon"]) for p in (member.get("geometry") or [])])
    return ways


def _stitch(ways):
    """Join boundary ways that share endpoints into closed rings."""
    remaining = [list(way) for way in ways if len(way) >= 2]
    rings = []
    while remaining:
        ring = remaining.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for index, way in enumerate(remaining):
                if way[0] == ring[-1]:
                    ring += way[1:]
                elif way[-1] == ring[-1]:
                    ring += list(reversed(way))[1:]
                elif way[-1] == ring[0]:
                    ring = way[:-1] + ring
                elif way[0] == ring[0]:
                    ring = list(reversed(way))[:-1] + ring
                else:
                    continue
                remaining.pop(index)
                changed = True
                break
        rings.append(ring)
    return rings


def _point_in_ring(lat, lon):
    def inside(ring):
        result = False
        count = len(ring)
        j = count - 1
        for i in range(count):
            yi, xi = ring[i]
            yj, xj = ring[j]
            if (xi > lon) != (xj > lon) and lat < (yj - yi) * (lon - xi) / (xj - xi) + yi:
                result = not result
            j = i
        return result
    return inside


def _governorate_from_polygons(lat, lon):
    for name, outers, inners in _POLYGONS:
        point_in_ring = _point_in_ring(lat, lon)
        if any(point_in_ring(ring) for ring in outers) and not any(
            point_in_ring(ring) for ring in inners
        ):
            return name
    return None


def governorate_for(candidate):
    for value in (candidate.get("state"), candidate.get("ar")):
        if not value:
            continue
        needle = normalize(value)
        for arabic, english in GOVERNORATE_AR.items():
            if normalize(arabic) == needle:
                return english
    by_boundary = _governorate_from_polygons(candidate["lat"], candidate["lon"])
    if by_boundary:
        return by_boundary
    best, best_d = None, float("inf")
    for name, (clat, clon) in GOVERNORATE_CENTRES.items():
        distance = haversine_m(candidate["lat"], candidate["lon"], clat, clon)
        if distance < best_d:
            best, best_d = name, distance
    return best


def merge(candidates):
    merged = []
    # Wikidata first, so a curated English label wins over an OSM Arabic name.
    for candidate in sorted(candidates, key=lambda c: 0 if c["src"] == "wd" else 1):
        hit = None
        for existing in merged:
            if haversine_m(candidate["lat"], candidate["lon"], existing["lat"], existing["lon"]) > 160:
                continue
            shared = _brand(candidate["en"]) & _brand(existing["en"])
            same_ar = candidate["ar"] and existing["ar"] and normalize(candidate["ar"]) == normalize(existing["ar"])
            if shared or same_ar:
                hit = existing
                break
        if hit is not None:
            hit["en"] = hit["en"] or candidate["en"]
            hit["ar"] = hit["ar"] or candidate["ar"]
        else:
            merged.append(dict(candidate))
    return merged


# Tokens that actually identify a hospital, versus words shared by thousands.
_STOP = {"hospital", "hospitals", "university", "general", "specialized", "central",
         "international", "national", "teaching", "medical", "health", "institute",
         "clinic", "center", "centre", "children", "child", "the", "and", "for", "al", "el"}


def _brand(name):
    return {word for word in normalize(name or "").split() if len(word) >= 4 and word not in _STOP}


# Well known hospitals have popular names that OSM does not carry, so a small
# set of aliases is curated here rather than inferred.
_KASR_ALIASES = "Qasr Al Aini|Kasr El Aini|Kasr El Ainy|Qasr al-Ayni Hospital"
CURATED = {
    # Both spellings of the same campus map to one name, so it does not matter
    # which the merge happened to keep.
    "cairo university hospital": ("Cairo University Hospital", "Qasr Al Aini|Kasr El Aini|Kasr El Ainy|Qasr al-Ayni Hospital"),
    "qasr al aini hospital": ("Cairo University Hospital", "Qasr Al Aini|Kasr El Aini|Kasr El Ainy|Qasr al-Ayni Hospital"),
    "al demerdash hospital": ("El Demerdash Hospital", "Demerdash"),
    "el demerdash hospital": ("El Demerdash Hospital", "Demerdash"),
    "57357 hospital": ("57357 Children's Cancer Hospital", "57357|Children Cancer Hospital Egypt"),
    # OSM has this one only in Arabic under a name that does not transliterate
    # cleanly, so it is given its English name here.
    normalize("مستشفي جامعة الأقصر"): ("Luxor University Hospital", None),
}


def to_rows(merged):
    for entry in merged:
        entry["gov"] = governorate_for(entry)
    seen, rows = set(), []
    for entry in sorted(merged, key=lambda e: (e["gov"] or "zz", (e["en"] or e["ar"]).lower())):
        name = entry["en"] or entry["ar"]
        key = (normalize(name), entry["gov"])
        if key in seen:
            continue
        seen.add(key)
        aliases = None
        current = normalize(name)
        if current in CURATED:
            name, aliases = CURATED[current]
        rows.append((name, entry["ar"], entry["gov"], aliases,
                     round(entry["lat"], 5), round(entry["lon"], 5)))
    rows.sort(key=lambda r: (r[2] or "zz", r[0].lower()))
    return rows


HEADER = '''"""Starter registry of Egyptian hospitals.

This is a seed list, not an authoritative registry. It differs from a
hand written list in one important way: every entry is a real hospital
and every coordinate is a real point, taken from OpenStreetMap and
Wikidata rather than typed in. A wrong coordinate does not fail loudly,
it quietly misroutes an ambulance, so nothing here is guessed.

Provenance:
- OpenStreetMap, queried through the Overpass API for amenity=hospital
  inside Egypt (data (c) OpenStreetMap contributors, ODbL).
- Wikidata items that are hospitals in Egypt, with their P625 point
  coordinates (Wikidata is CC0).
Both were fetched, de-duplicated and grouped by governorate by
scripts/build_registry.py. Re-run that script to refresh the list.

For a production deployment the authority should be GS1 Egypt's
Healthcare Location Register, which assigns each facility a verified
Global Location Number and is already aligned to MoHP and the Egyptian
Drug Authority. A GLN is a far better identity anchor than a name,
because names repeat across governorates and a GLN cannot.
"""

# (english_name, arabic_name_or_None, governorate, aliases_or_None, lat, lon)
#
# Aliases matter more than they look. Hospitals are popularly known by
# names that are absent from any official list, so a search that misses
# them sends people to the claim form and produces review work a lookup
# could have avoided. They are extra names to match on, never the primary
# identity. Coordinates are real, from the sources named above: they are
# filled in so the national map can plot every hospital, and a reseed
# never overwrites a coordinate that is already stored.
SEED_REGISTRY = [
'''


def _quote(value):
    if value is None:
        return "None"
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def render(rows):
    by_gov = defaultdict(list)
    for row in rows:
        by_gov[row[2]].append(row)
    parts = [HEADER]
    for gov in sorted(by_gov):
        group = sorted(by_gov[gov], key=lambda r: r[0].lower())
        parts.append(f"    # {gov} ({len(group)})\n")
        for name, ar, governorate, aliases, lat, lon in group:
            parts.append(
                f"    ({_quote(name)}, {_quote(ar)}, {_quote(governorate)}, "
                f"{_quote(aliases)}, {lat}, {lon}),\n"
            )
        parts.append("\n")
    parts.append("]\n")
    return "".join(parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    args = parser.parse_args()

    global _POLYGONS

    print("fetching governorate boundaries...")
    _POLYGONS = fetch_boundaries()
    print(f"  {len(_POLYGONS)} boundaries")
    print("fetching OpenStreetMap hospitals...")
    osm = fetch_osm()
    print(f"  {len(osm)} hospitals")
    print("fetching Wikidata hospitals...")
    wikidata = fetch_wikidata()
    print(f"  {len(wikidata)} hospitals with coordinates")
    time.sleep(1)

    candidates = [c for c in osm + wikidata if in_egypt(c["lat"], c["lon"])]
    rows = to_rows(merge(candidates))
    counts = Counter(row[2] for row in rows)
    print(f"\n{len(rows)} hospitals across {len(counts)} governorates")
    for gov in sorted(counts):
        print(f"  {gov}: {counts[gov]}")
    if len(counts) < 27:
        missing = set(GOVERNORATE_AR.values()) - set(counts)
        print(f"WARNING: no hospitals found for {sorted(missing)}")

    if args.dry_run:
        print("\ndry run, nothing written")
        return 0
    SEED_PATH.write_text(render(rows), encoding="utf-8")
    print(f"\nwrote {SEED_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

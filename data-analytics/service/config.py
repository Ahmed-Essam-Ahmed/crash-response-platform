"""Runtime configuration for the analytics service.

The service is read-only: it never writes to the operational database. Every
knob is an environment variable so the demo defaults work with no setup.
"""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "hospital-website" / "data" / "hospital.db"

DB_PATH = os.environ.get("DB_PATH", str(DEFAULT_DB))

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

# The dashboard is the national authority's view, so only this role may read it.
ALLOWED_ROLES = tuple(
    role.strip() for role in os.environ.get("ANALYTICS_ROLES", "authority").split(",") if role.strip()
)

# Fixed grid used to aggregate crash points into "red zone" cells, in degrees.
# 0.002 deg is roughly 220 m, fine enough to follow a road at city scale.
HOTSPOT_SPACING = float(os.environ.get("HOTSPOT_SPACING", "0.002"))

# Cap on rows pulled from the store, newest first. 0 means no cap, so the
# authority view always covers the same incidents the hospital service holds.
MAX_INCIDENTS = int(os.environ.get("MAX_INCIDENTS", "0"))

# The national seeder and live demo source use these prefixes. Keeping the
# provenance rule here means the API can label synthetic rows instead of
# letting a demo dashboard look like a production feed.
DEMO_TRIP_PREFIXES = tuple(
    prefix.strip()
    for prefix in os.environ.get(
        "DEMO_TRIP_PREFIXES", "demo-,trip-demo-,national-demo-"
    ).split(",")
    if prefix.strip()
)

# A short read-through cache keeps polling dashboards from re-reading and
# re-parsing the entire SQLite file on every request. The cache is invalidated
# by the database mtime/size as well as this TTL.
CACHE_TTL_SECONDS = float(os.environ.get("CACHE_TTL_SECONDS", "2.0"))

SEVERITY_BUCKETS = [
    ("1-3", 1.0, 3.0),
    ("3-5", 3.0, 5.0),
    ("5-7", 5.0, 7.0),
    ("7-9", 7.0, 9.0),
    ("9-10", 9.0, 10.01),
]

AGE_GROUPS = [
    ("0-17", 0, 17),
    ("18-25", 18, 25),
    ("26-40", 26, 40),
    ("41-60", 41, 60),
    ("61+", 61, 200),
]

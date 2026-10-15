"""Egypt governorate lookup by latitude and longitude.

This is an approximate, dependency-free way to filter "all Egypt" by region
without adding a schema field to incidents. For the demo coordinates
(~30.04, 31.24) this resolves to Cairo.
"""

from math import asin, cos, radians, sin, sqrt
from typing import Tuple


# Approximate center coordinates for Egypt's 27 governorates.
# This is intentionally coarse for this assignment, but covers the demo area.
GOVERNORATES: dict[str, Tuple[float, float]] = {
    "Alexandria": (31.2001, 29.9187),
    "Aswan": (24.0889, 32.8998),
    "Asyut": (27.1809, 31.1837),
    "Beheira": (31.0341, 30.4682),
    "Beni Suef": (29.0661, 31.0994),
    "Cairo": (30.0444, 31.2357),
    "Dakahlia": (31.0409, 31.3785),
    "Damietta": (31.4165, 31.8133),
    "Fayoum": (29.3084, 30.8428),
    "Gharbia": (30.7865, 31.0004),
    "Giza": (30.0131, 31.2089),
    "Ismailia": (30.5965, 32.2715),
    "Kafr El Sheikh": (31.1107, 30.9388),
    "Luxor": (25.6872, 32.6396),
    "Matrouh": (31.3543, 27.2373),
    "Minya": (28.1099, 30.7503),
    "Monufia": (30.5540, 31.0100),
    "New Valley": (25.4514, 30.5464),
    "North Sinai": (31.1310, 33.7983),
    "Port Said": (31.2653, 32.3019),
    "Qalyubia": (30.4667, 31.1833),
    "Qena": (26.1551, 32.7160),
    "Red Sea": (27.2579, 33.8116),
    "Sharqia": (30.5877, 31.5020),
    "Sohag": (26.5591, 31.6957),
    "South Sinai": (28.2415, 33.6226),
    "Suez": (29.9668, 32.5498),
}


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(max(0.0, min(1.0, a))))
    return 6371000 * c


def region_for(lat: float, lon: float, max_radius_m: float = 120_000) -> str | None:
    """Return the best-matching governorate. If none is close, return None.

    The heuristic is "nearest center" — it is sufficient for the demo world
    and for a coarse national filter. More accurate polygon lookup could be
    added if the dataset grows.
    """
    best = None
    best_d = 10**12
    for name, (glat, glon) in GOVERNORATES.items():
        d = haversine_m(lat, lon, glat, glon)
        if d < best_d:
            best_d = d
            best = name
            if best_d < 5000:
                break
    if best_d <= max_radius_m:
        return best
    return None

"""Aggregation layer: turns filtered incidents into dashboard-ready shapes.

Every function here is pure — it takes the incident dicts produced by
``store.load`` and a ``Filters`` object and returns plain JSON-serialisable
data. Nothing in this module touches the database or the network.
"""

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import AGE_GROUPS, HOTSPOT_SPACING, SEVERITY_BUCKETS
from filters import Filters, passes

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

RESPONSE_BUCKETS = [
    ("< 5 min", 0, 300),
    ("5-10 min", 300, 600),
    ("10-15 min", 600, 900),
    ("15-30 min", 900, 1800),
    ("30+ min", 1800, 10**9),
]


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _seconds(a: Optional[datetime], b: Optional[datetime]) -> Optional[float]:
    if a is None or b is None:
        return None
    delta = (a - b).total_seconds()
    return delta if delta >= 0 else None


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 1)
    rank = (len(ordered) - 1) * pct
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    frac = rank - low
    return round(ordered[low] + (ordered[high] - ordered[low]) * frac, 1)


def _filtered(incidents: List[Dict[str, Any]], f: Filters) -> List[Dict[str, Any]]:
    out = []
    for inc in incidents:
        if passes(inc, f, inc.get("region"), inc.get("age_group")):
            out.append(inc)
    return out


def _hotspots(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cells: Dict[tuple, Dict[str, float]] = {}
    for inc in incidents:
        try:
            lat = float(inc["lat"])
            lon = float(inc["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        key = (round(lat / HOTSPOT_SPACING), round(lon / HOTSPOT_SPACING))
        cell = cells.setdefault(
            key,
            {"lat": key[0] * HOTSPOT_SPACING, "lon": key[1] * HOTSPOT_SPACING, "count": 0, "max_severity": 0.0},
        )
        cell["count"] += 1
        cell["max_severity"] = max(cell["max_severity"], float(inc.get("severity") or 0.0))
    out = []
    for cell in cells.values():
        out.append(
            {
                "lat": round(cell["lat"], 5),
                "lon": round(cell["lon"], 5),
                "count": int(cell["count"]),
                "max_severity": round(cell["max_severity"], 1),
            }
        )
    out.sort(key=lambda c: (-c["count"], -c["max_severity"]))
    return out


def _by_hour(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counts = [0] * 24
    for inc in incidents:
        dt = _parse_dt(inc.get("created_at"))
        if dt:
            counts[dt.hour] += 1
    return [{"hour": h, "count": counts[h]} for h in range(24)]


def _by_weekday(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counts = [0] * 7
    for inc in incidents:
        dt = _parse_dt(inc.get("created_at"))
        if dt:
            counts[dt.weekday()] += 1
    return [{"day": WEEKDAYS[i], "count": counts[i]} for i in range(7)]


def _trend(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = defaultdict(int)
    sev_sum: Dict[str, float] = defaultdict(float)
    for inc in incidents:
        dt = _parse_dt(inc.get("created_at"))
        if not dt:
            continue
        day = dt.date().isoformat()
        counts[day] += 1
        sev_sum[day] += float(inc.get("severity") or 0.0)
    return [
        {"date": day, "count": counts[day], "avg_severity": round(sev_sum[day] / counts[day], 1)}
        for day in sorted(counts)
    ]


def _severity_distribution(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for label, low, high in SEVERITY_BUCKETS:
        count = sum(1 for inc in incidents if low <= float(inc.get("severity") or 0.0) < high)
        out.append({"bucket": label, "count": count})
    return out


def _by_region(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    agg: Dict[str, Dict[str, float]] = {}
    for inc in incidents:
        region = inc.get("region") or "Unknown"
        row = agg.setdefault(region, {"count": 0, "sev_sum": 0.0, "severe": 0})
        sev = float(inc.get("severity") or 0.0)
        row["count"] += 1
        row["sev_sum"] += sev
        if sev >= 8:
            row["severe"] += 1
    out = [
        {
            "region": region,
            "count": int(row["count"]),
            "avg_severity": round(row["sev_sum"] / row["count"], 1) if row["count"] else 0.0,
            "severe": int(row["severe"]),
        }
        for region, row in agg.items()
    ]
    out.sort(key=lambda r: -r["count"])
    return out


def _response_seconds(inc: Dict[str, Any]) -> Optional[float]:
    created = _parse_dt(inc.get("created_at"))
    closed = _parse_dt(inc.get("closed_at"))
    return _seconds(closed, created)


def _by_hospital(incidents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    agg: Dict[str, Dict[str, Any]] = {}
    for inc in incidents:
        code = inc.get("hospital_code") or ""
        name = inc.get("hospital_name") or ""
        key = str(code) or str(name)
        if not key:
            continue
        row = agg.setdefault(key, {"code": code, "name": name, "count": 0, "sev_sum": 0.0, "resp": [], "resp_sum": 0.0, "resp_n": 0})
        sev = float(inc.get("severity") or 0.0)
        row["count"] += 1
        row["sev_sum"] += sev
        secs = _response_seconds(inc)
        if secs is not None:
            row["resp_sum"] += secs
            row["resp_n"] += 1
    out = [
        {
            "hospital_code": str(row["code"]),
            "hospital_name": str(row["name"]),
            "count": int(row["count"]),
            "avg_severity": round(row["sev_sum"] / row["count"], 1) if row["count"] else 0.0,
            "avg_response_seconds": round(row["resp_sum"] / row["resp_n"], 1) if row["resp_n"] else 0.0,
        }
        for row in agg.values()
    ]
    out.sort(key=lambda r: -r["count"])
    return out


def _demographics(incidents: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_sex: Dict[str, int] = defaultdict(int)
    by_age: Dict[str, int] = defaultdict(int)
    for inc in incidents:
        sex = (inc.get("gender") or inc.get("sex") or "").strip().lower()
        if sex:
            by_sex[sex] += 1
        age = inc.get("age_group")
        if age:
            by_age[age] += 1
    age_order = [g for g, _, _ in AGE_GROUPS]
    return {
        "by_sex": [{"sex": s, "count": c} for s, c in sorted(by_sex.items(), key=lambda kv: -kv[1])],
        "by_age_group": [
            {"group": g, "count": by_age.get(g, 0)} for g in age_order if g in by_age
        ],
    }


def _response_times(incidents: List[Dict[str, Any]]) -> Dict[str, Any]:
    totals: List[float] = []
    accept: List[float] = []
    scene: List[float] = []
    hospital: List[float] = []
    for inc in incidents:
        created = _parse_dt(inc.get("created_at"))
        accepted = _parse_dt(inc.get("accepted_at"))
        closed = _parse_dt(inc.get("closed_at"))

        accept_s = _seconds(accepted, created)
        if accept_s is not None:
            accept.append(accept_s)
        scene_s = inc.get("eta_scene_seconds")
        if scene_s is not None:
            scene.append(float(scene_s))
        hospital_s = inc.get("eta_hospital_seconds")
        if hospital_s is not None:
            hospital.append(float(hospital_s))
        total_s = _seconds(closed, created)
        if total_s is not None:
            totals.append(total_s)

    def avg(values: List[float]) -> float:
        return round(sum(values) / len(values), 1) if values else 0.0

    buckets = [
        {"label": label, "count": sum(1 for t in totals if low <= t < high)}
        for label, low, high in RESPONSE_BUCKETS
    ]
    return {
        "count": len(totals),
        "avg_accept_seconds": avg(accept),
        "avg_scene_travel_seconds": avg(scene),
        "avg_hospital_travel_seconds": avg(hospital),
        "avg_total_seconds": avg(totals),
        "p50": _percentile(totals, 0.5),
        "p90": _percentile(totals, 0.9),
        "buckets": buckets,
    }


def _distribution(incidents: List[Dict[str, Any]], field: str) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = defaultdict(int)
    for inc in incidents:
        value = (inc.get(field) or "").strip().lower()
        if value:
            counts[value] += 1
    return [{"key": k, "count": c} for k, c in sorted(counts.items(), key=lambda kv: -kv[1])]


def _totals(incidents: List[Dict[str, Any]]) -> Dict[str, Any]:
    count = len(incidents)
    sev_sum = sum(float(inc.get("severity") or 0.0) for inc in incidents)
    severe = sum(1 for inc in incidents if float(inc.get("severity") or 0.0) >= 8)
    critical = sum(1 for inc in incidents if float(inc.get("severity") or 0.0) >= 7)
    unclaimed = sum(1 for inc in incidents if not inc.get("hospital_id"))
    hospitals = {str(inc.get("hospital_code") or inc.get("hospital_id") or "") for inc in incidents}
    regions = {inc.get("region") for inc in incidents if inc.get("region")}

    scene = [float(inc["eta_scene_seconds"]) for inc in incidents if inc.get("eta_scene_seconds") is not None]
    resp = [_response_seconds(inc) for inc in incidents]
    resp = [r for r in resp if r is not None]

    return {
        "incidents": count,
        "avg_severity": round(sev_sum / count, 1) if count else 0.0,
        "severe": severe,
        "critical": critical,
        "avg_response_seconds": round(sum(resp) / len(resp), 1) if resp else 0.0,
        "avg_scene_seconds": round(sum(scene) / len(scene), 1) if scene else 0.0,
        "hospitals_active": len({h for h in hospitals if h}),
        "regions_active": len(regions),
        "unclaimed": unclaimed,
    }


def aggregate(incidents: List[Dict[str, Any]], f: Filters) -> Dict[str, Any]:
    """Aggregate ``incidents`` into the full dashboard payload."""
    data = _filtered(incidents, f)
    return {
        "totals": _totals(data),
        "hotspots": _hotspots(data),
        "by_hour": _by_hour(data),
        "by_weekday": _by_weekday(data),
        "trend": _trend(data),
        "severity_distribution": _severity_distribution(data),
        "by_region": _by_region(data),
        "by_hospital": _by_hospital(data),
        "demographics": _demographics(data),
        "response_times": _response_times(data),
        "destination_distribution": _distribution(data, "destination"),
        "status_distribution": _distribution(data, "status"),
    }

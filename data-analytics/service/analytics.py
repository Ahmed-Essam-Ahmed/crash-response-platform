"""Analytics aggregation over the incident store.

Reads the operational SQLite database written by hospital-website/backend and
turns raw incidents into hotspots, time patterns and severity distributions.
Kept dependency-free (stdlib sqlite3) so it can also run as a CLI.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

WORLD = {"spacing": 0.004}
SEVERITY_BUCKETS = [(0, 3), (3, 6), (6, 8), (8, 10)]


def load_incidents(db_path):
    path = Path(db_path)
    if not path.exists():
        return []
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            "SELECT alert_id, trip_id, severity, lat, lon, status, hospital_id, "
            "ambulance_id, contacts_notified, created_at FROM incidents "
            "ORDER BY created_at DESC LIMIT 5000"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        con.close()


def hotspots(incidents, spacing=None):
    spacing = spacing or WORLD["spacing"]
    cells = {}
    for inc in incidents:
        key = (round(inc["lat"] / spacing), round(inc["lon"] / spacing))
        cell = cells.get(key)
        if cell is None:
            cells[key] = {"lat": inc["lat"], "lon": inc["lon"], "count": 1,
                          "max_severity": inc["severity"]}
        else:
            cell["count"] += 1
            cell["lat"] = (cell["lat"] * (cell["count"] - 1) + inc["lat"]) / cell["count"]
            cell["lon"] = (cell["lon"] * (cell["count"] - 1) + inc["lon"]) / cell["count"]
            cell["max_severity"] = max(cell["max_severity"], inc["severity"])
    return sorted(cells.values(), key=lambda c: (-c["count"], -c["max_severity"]))


def by_hour(incidents):
    counts = [0] * 24
    for inc in incidents:
        try:
            counts[datetime.fromisoformat(inc["created_at"]).hour] += 1
        except (TypeError, ValueError):
            continue
    return [{"hour": h, "count": counts[h]} for h in range(24)]


def severity_distribution(incidents):
    out = []
    for lo, hi in SEVERITY_BUCKETS:
        n = sum(1 for i in incidents if lo <= i["severity"] < hi or (hi == 10 and i["severity"] >= 8))
        out.append({"bucket": f"{lo}-{hi}", "count": n})
    return out


def summary(incidents):
    sev = [i["severity"] for i in incidents]
    hot = hotspots(incidents)
    return {
        "totals": {
            "incidents": len(incidents),
            "hot_cells": len(hot),
            "severe": sum(1 for s in sev if s >= 7),
            "avg_severity": round(sum(sev) / len(sev), 2) if sev else 0.0,
        },
        "hotspots": hot,
        "by_hour": by_hour(incidents),
        "severity_distribution": severity_distribution(incidents),
    }

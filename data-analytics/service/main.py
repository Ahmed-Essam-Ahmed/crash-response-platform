"""Data analytics service (rewritten for authority national view).

Rebuilt from scratch to support:
- region filtering (derived from lat/lon)
- demographics (age group, sex)
- response times (dispatch → arrival)
- rich charts + KPIs
- authority/admin token validation
"""

import os
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from auth import AuthError, CurrentUser, get_current_user
from config import ALLOWED_ROLES, CORS_ORIGINS, DB_PATH
from store import load
from filters import parse_filters, passes
from analytics import aggregate


app = FastAPI(title="National Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_path = DB_PATH
if not Path(db_path).exists() and (root := Path(__file__).resolve().parents[2] / "hospital-website" / "data" / "hospital.db").exists():
    db_path = str(root)


async def get_user(authorization: str = Header(default="")) -> CurrentUser:
    raw = None
    if authorization.lower().startswith("bearer "):
        raw = authorization[7:].strip()
    try:
        return get_current_user(raw, db_path, tuple(ALLOWED_ROLES))
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=exc.detail) from exc


@app.get("/health")
def health():
    p = Path(db_path)
    return {"status": "ok", "db": str(db_path), "exists": p.exists()}


@app.get("/analytics/filters")
def analytics_filters(user: CurrentUser = Depends(get_user)):
    incidents = load(db_path)
    regions = sorted(set(x.get("region") for x in incidents if x.get("region")))
    hospitals = []
    seen = set()
    for x in incidents:
        code = x.get("hospital_code") or x.get("hospital_id")
        name = x.get("hospital_name") or ""
        key = (code, name)
        if code and key not in seen:
            seen.add(key)
            hospitals.append({"code": str(code), "name": str(name)})
        elif not code and name and name not in seen:
            seen.add(name)
            hospitals.append({"code": "", "name": str(name)})
    sexes = sorted(set((x.get("gender") or "").lower() for x in incidents if x.get("gender")))
    age_groups = sorted(set(x.get("age_group") for x in incidents if x.get("age_group")))
    destinations = sorted(set((x.get("destination") or "").lower() for x in incidents if x.get("destination")))
    statuses = sorted(set((x.get("status") or "").lower() for x in incidents if x.get("status")))
    dates = [x.get("created_at") for x in incidents if x.get("created_at")]
    date_from = min(dates) if dates else None
    date_to = max(dates) if dates else None
    sev = [float(x.get("severity") or 0.0) for x in incidents]
    return {
        "regions": regions,
        "hospitals": hospitals,
        "sexes": sexes,
        "age_groups": age_groups,
        "destinations": destinations,
        "statuses": statuses,
        "date_from": date_from,
        "date_to": date_to,
        "severity_min": min(sev) if sev else 0.0,
        "severity_max": max(sev) if sev else 10.0,
    }


def _query_params(request: Request) -> dict:
    collected: dict[str, list[str]] = {}
    for key, value in request.query_params.multi_items():
        collected.setdefault(key, []).append(value)
    return collected


@app.get("/analytics/summary")
def analytics_summary(request: Request, user: CurrentUser = Depends(get_user)):
    incidents = load(db_path)
    f = parse_filters(_query_params(request))
    return aggregate(incidents, f)


@app.get("/analytics/incidents")
def analytics_incidents(request: Request, user: CurrentUser = Depends(get_user)):
    incidents = load(db_path)
    f = parse_filters(_query_params(request))

    items = []
    for inc in incidents:
        if passes(inc, f, inc.get("region"), inc.get("age_group")):
            items.append(inc)
    return items

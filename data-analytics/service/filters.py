"""Filter parsing and application for analytics queries."""

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable


@dataclass(frozen=True)
class Filters:
    regions: list[str]
    date_from: datetime | None
    date_to: datetime | None
    severity_min: float
    severity_max: float
    hospitals: list[str]  # hospital codes or names
    sex: list[str]
    age_groups: list[str]  # 0-17,18-25,26-40,41-60,61+
    destinations: list[str]
    statuses: list[str]


def parse_filters(params: dict) -> Filters:
    def _list(key: str) -> list[str]:
        vals = params.get(key)
        if not vals:
            return []
        if isinstance(vals, str):
            raw = [vals]
        elif isinstance(vals, Iterable) and not isinstance(vals, (bytes, str)):
            raw = [str(v) for v in vals]
        else:
            raw = []
        out: list[str] = []
        for item in raw:
            out.extend(part.strip() for part in item.split(",") if part.strip())
        return out

    def _float(key: str, default: float) -> float:
        try:
            v = params.get(key)
            if v in (None, ""):
                return default
            return float(v)
        except Exception:
            return default

    def _dt(key: str) -> datetime | None:
        try:
            v = params.get(key)
            if not v:
                return None
            s = str(v)
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
                try:
                    return datetime.strptime(s[: len(fmt)], fmt)
                except Exception:
                    continue
            return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None

    return Filters(
        regions=_list("region"),
        date_from=_dt("from"),
        date_to=_dt("to"),
        severity_min=_float("severity_min", 0.0),
        severity_max=_float("severity_max", 10.0),
        hospitals=_list("hospital"),
        sex=_list("sex"),
        age_groups=_list("age_group"),
        destinations=_list("destination"),
        statuses=_list("status"),
    )


def passes(inc: dict, f: Filters, region: str | None, age_group: str | None) -> bool:
    sev = inc.get("severity") or 0.0
    if sev < f.severity_min or sev > f.severity_max:
        return False
    dt = inc.get("created_at")
    if f.date_from:
        try:
            c = datetime.fromisoformat(str(dt)) if dt else None
            if c and c < f.date_from:
                return False
        except Exception:
            pass
    if f.date_to:
        try:
            c = datetime.fromisoformat(str(dt)) if dt else None
            if c and c > f.date_to:
                return False
        except Exception:
            pass
    if f.regions:
        if region not in f.regions:
            return False
    if f.hospitals:
        hcode = inc.get("hospital_code") or ""
        hname = inc.get("hospital_name") or ""
        if hcode not in f.hospitals and hname not in f.hospitals:
            return False
    if f.sex:
        s = (inc.get("gender") or inc.get("sex") or "").lower()
        if s not in [x.lower() for x in f.sex]:
            return False
    if f.age_groups:
        if age_group not in f.age_groups:
            return False
    if f.destinations:
        d = (inc.get("destination") or "").lower()
        if d not in [x.lower() for x in f.destinations]:
            return False
    if f.statuses:
        st = (inc.get("status") or "").lower()
        if st not in [x.lower() for x in f.statuses]:
            return False
    return True

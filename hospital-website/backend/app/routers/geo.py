import json
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Query

from ..config import NOMINATIM_TIMEOUT, NOMINATIM_URL

router = APIRouter(prefix="/geo", tags=["geo"])

USER_AGENT = "crash-response-platform/3.0 (hospital registration lookup)"


@router.get("/search")
def search(
    q: str = Query(min_length=2, max_length=120),
    limit: int = Query(default=6, ge=1, le=10),
):
    """Keyless geocoding so a hospital can find itself by name at signup."""
    url = f"{NOMINATIM_URL}?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1}
    )
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=NOMINATIM_TIMEOUT) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="location search is unavailable right now, add the coordinates manually",
        )

    results = []
    for row in data or []:
        lat, lon = row.get("lat"), row.get("lon")
        if lat is None or lon is None:
            continue
        results.append(
            {
                "label": row.get("display_name"),
                "lat": float(lat),
                "lon": float(lon),
                "type": row.get("type") or row.get("class") or "place",
            }
        )
    return {"query": q, "results": results}

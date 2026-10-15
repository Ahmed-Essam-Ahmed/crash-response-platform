import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import migrations
from .config import CORS_ORIGINS, DATABASE_URL
from .db import SessionLocal, engine
from .realtime import realtime
from .routers import auth, cases, geo, me, stream
from .services import demo_source, escalation, hospital_registry, progression, registry
from .services.hospital_seed import SEED_REGISTRY


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrations.apply(engine)
    db = SessionLocal()
    try:
        hospital_registry.seed_registry(db, SEED_REGISTRY)
        registry.seed(db)
    finally:
        db.close()

    tasks = [asyncio.create_task(progression.run()), asyncio.create_task(escalation.run())]
    if demo_source.enabled():
        tasks.append(asyncio.create_task(demo_source.run()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()


app = FastAPI(
    title="Hospital Response Service",
    version="3.0.0",
    description=(
        "Multi-tenant hospital console. Each hospital claims one entry in a curated "
        "registry, so a hospital cannot hold two accounts and cannot be created by "
        "anyone who types a plausible name. Staff join by email invitation from their "
        "hospital admin. Each hospital sees only its own cases, fleet, and beds. Cases "
        "arrive from the app and AI model and are offered to the nearest eligible "
        "hospital, escalating until one accepts."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(geo.router)
app.include_router(cases.router)
app.include_router(me.router)
app.include_router(stream.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "hospital-response",
        "version": "3.0.0",
        "database": DATABASE_URL,
        "stream_clients": realtime.clients,
        "stream_hospitals": realtime.hospitals,
        "time": datetime.utcnow().isoformat(),
    }


@app.get("/")
def index():
    return {
        "service": "hospital-response",
        "auth": {
            "registry_search": "GET /auth/registry",
            "join": "POST /auth/join",
            "claim_hospital": "POST /auth/claims",
            "review_claims": "GET /auth/review/claims (X-Review-Key)",
            "approve_claim": "POST /auth/review/claims/{id}/approve (X-Review-Key)",
            "reject_claim": "POST /auth/review/claims/{id}/reject (X-Review-Key)",
            "invitation_preview": "GET /auth/invitations/{token}",
            "invitation_accept": "POST /auth/invitations/{token}/accept",
            "login": "POST /auth/login",
            "me": "GET /auth/me",
            "staff": "GET /auth/staff",
            "invitations": "GET|POST /auth/staff/invitations",
        },
        "intake": {"report_case": "POST /cases (X-Ingest-Key)"},
        "console": {
            "cases": "GET /me/cases",
            "accept": "POST /me/cases/{alert_id}/accept",
            "advance": "POST /me/cases/{alert_id}/advance",
            "fleet": "GET|PATCH /me/fleet",
            "beds": "GET|PATCH /me/beds",
            "stream": "WS /me/stream?token=",
        },
        "geo": {"search": "GET /geo/search"},
    }

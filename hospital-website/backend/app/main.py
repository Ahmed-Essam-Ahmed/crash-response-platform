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
from .services import demo_source, escalation, progression, registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrations.apply(engine)
    db = SessionLocal()
    try:
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
        "Multi-tenant hospital console. Each hospital signs in and sees only its own "
        "cases, fleet, and beds. Cases arrive from the app and AI model and are offered "
        "to the nearest eligible hospital, escalating until one accepts."
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
            "register": "POST /auth/register",
            "login": "POST /auth/login",
            "me": "GET /auth/me",
            "staff": "GET /auth/staff",
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
